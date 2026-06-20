import secrets
import string
import os
from datetime import datetime, timedelta
import logging
import jwt
from jwt.exceptions import PyJWTError as JWTError
from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import DBManager

logger = logging.getLogger(__name__)

# JWT Config — loaded from environment variables (no hardcoded defaults)
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("FATAL: JWT_SECRET_KEY environment variable is not set. Server cannot start without it.")
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)

class AuthAgent:
    """
    Layer 2 Orchestration: Security & Authentication Watchdog.

    Handles the issuance, verification, and revocation of JSON Web Tokens (JWT).
    Implements a rigorous Single-Device lock-out constraint by aggressively
    invalidating sibling sessions in the database before generating new JWT payloads
    (HS256 symmetric signing).
    """
    def __init__(self):
        self.db = DBManager()
        self.token_expiry = {
            "daily": 1,
            "monthly": 30,
            "yearly": 365
        }

    def generate_license_token(self, tier: str = "monthly", email: str = None) -> tuple[str, str]:
        """Generates a secure 16-char alphanumeric license key and persists it to the DB"""
        charset = string.ascii_uppercase + string.digits
        token = '-'.join([''.join(secrets.choice(charset) for _ in range(4)) for _ in range(4)])
        
        days = self.token_expiry.get(tier.lower(), 30)
        expires_at = (datetime.utcnow() + timedelta(days=days)).isoformat()
        
        success = self.db.create_token(token, tier, expires_at)
        if not success:
            raise Exception("Failed to generate token (collision or DB error)")

        # If email is provided, immediately pre-register the user so they appear in admin
        if email:
            import secrets as _s
            dummy_session = _s.token_urlsafe(16)
            try:
                self.db.bind_token_to_email(token, email, dummy_session)
            except Exception as bind_err:
                logger.warning(f"Could not pre-bind email {email} to token: {bind_err}")
            
        return token, expires_at


    def create_session_jwt(self, token_data: dict, ip_address: str, user_agent: str = "") -> str:
        """
        Creates a JWT for authenticated sessions bound to the client's fingerprint.

        Args:
            token_data (dict): The original license token metadata.
            ip_address (str): The requesting client IP address.
            user_agent (str): Extracted navigator/browser string for auditing.

        Returns:
            str: An HS256 symmetrically signed JWT containing the session payload.
            
        Security Note:
            This method actively coordinates with the DBManager to assert
            Single-Device constraints, silently dropping previous sessions.
        """
        session_key = secrets.token_urlsafe(32)
        expire = datetime.utcnow() + timedelta(days=self.token_expiry.get(token_data['tier'].lower(), 30))
        
        # Fetch max_users limit from admin_config if it exists for this token
        config = self.db.get_admin_config()
        max_users = config.get(f"TOKEN_LIMIT_{token_data['token_code']}", 1)
        
        # Bind session in DB (Watchdog logic)
        try:
            self.db.bind_token_to_session(token_data['id'], session_key, ip_address, max_users=max_users)
        except ValueError as e:
            raise HTTPException(status_code=403, detail=str(e))
        
        to_encode = {
            "sub": session_key,
            "exp": expire,
            "tier": token_data['tier'],
            "device": user_agent[:80]  # Store abbreviated fingerprint inside JWT payload
        }
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    def redeem_token(self, token_code: str, ip_address: str, user_agent: str = "") -> str:
        """Redeem a token and return a JWT if valid"""
        token = self.db.get_token(token_code)
        
        if not token:
            raise HTTPException(status_code=404, detail="Invalid token")
            
        # Removed strict layout constraint for single-use:
        # We now check max_users limit inside bind_token_to_session, so it can handle re-use 
        # based on Company vs Individual tiers.
            
        if not token['is_active']:
            raise HTTPException(status_code=403, detail="Token has been deactivated")
            
        # Address cross-OS and database TZ formatting issues
        # Python 3.10 fromisoformat fails if fractional seconds are present but not exactly 3 or 6 digits
        expires_str = str(token.get('expires_at', '')).replace("Z", "+00:00")
        if "." in expires_str and "+" in expires_str:
            base, tz = expires_str.split("+", 1)
            expires_str = f"{base.split('.')[0]}+{tz}"
        elif "." in expires_str:
            expires_str = expires_str.split(".")[0]
            
        try:
            expires_at = datetime.fromisoformat(expires_str)
        except ValueError:
            # Absolute fallback to prevent 500 error
            expires_at = datetime.utcnow() + timedelta(days=30)
        utc_now = datetime.utcnow()
        if expires_at.tzinfo is not None:
            utc_now = utc_now.replace(tzinfo=expires_at.tzinfo)
            
        if utc_now > expires_at:
            raise HTTPException(status_code=403, detail="Token has expired")
            
        return self.create_session_jwt(token, ip_address, user_agent)

    def get_optional_user(self, credentials: HTTPAuthorizationCredentials = Security(security)):
        """Returns the current user or None — never raises. Safe for optional-auth routes."""
        if not credentials or not credentials.credentials:
            return None
        try:
            return self._resolve_user(credentials.credentials)
        except HTTPException:
            return None

    def get_current_user(self, credentials: HTTPAuthorizationCredentials = Security(security)):
        """
        Watchdog Dependency Guard: FastAPI Route Dependency.
        Raises 401 if no valid Bearer token is provided.
        """
        if not credentials or not credentials.credentials:
            raise HTTPException(status_code=401, detail="Authentication required")
        return self._resolve_user(credentials.credentials)

    def _resolve_user(self, raw_token: str) -> dict:
        """Internal: decode JWT and load user from DB. Raises HTTPException on any failure."""
        try:
            payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
            session_key: str = payload.get("sub")
            if session_key is None:
                raise HTTPException(status_code=401, detail="Invalid session credentials")
        except JWTError as je:
            raise HTTPException(status_code=401, detail=f"Could not validate credentials: {je}")

        user = self.db.get_user_by_session(session_key)
        if user is None:
            raise HTTPException(status_code=401, detail="Session not found or revoked")

        # Check DB-level expiry
        if user.get('expires_at'):
            expires_at = datetime.fromisoformat(str(user['expires_at']).replace("Z", "+00:00"))
            utc_now = datetime.utcnow()
            if expires_at.tzinfo is not None:
                utc_now = utc_now.replace(tzinfo=expires_at.tzinfo)
            if utc_now > expires_at:
                raise HTTPException(status_code=403, detail="Subscription expired")

        return user

    def get_user_from_query(self, token: str = None):
        """Used for raw GET endpoints where Authorization Headers aren't possible."""
        if not token:
            return None
        try:
            return self._resolve_user(token)
        except HTTPException:
            return None

    def enforce_rate_limits(self, user: dict = None, ip_address: str = None):
        """
        Search Coordinator: Checks if user can perform a search.
        
        For authenticated users, the limit is always admin-defined via
        admin_config key: SEARCH_LIMIT_{token_code}
        If no limit is set for a token, the user is BLOCKED until the admin sets one.
        """
        config = self.db.get_admin_config()
        trial_enabled = config.get("TRIAL_ENABLED", True)

        try:
            free_limit = int(config.get("FREE_RESULT_LIMIT", 50))
        except (ValueError, TypeError):
            free_limit = 50

        if user is None:
            # Unauthenticated / trial user
            if not trial_enabled:
                raise HTTPException(status_code=403, detail="Trials are currently disabled. Please enter a license token.")
            remaining = self.db.get_free_usage_remaining(ip_address, free_limit) if ip_address else free_limit
            if remaining <= 0:
                raise HTTPException(status_code=429, detail=f"Daily trial limit ({free_limit} leads) reached. Please check back tomorrow or unlock Elite.")
            return {"status": "trial", "limit": remaining, "ip_address": ip_address}

        # Authenticated user — limit always comes from admin_config
        token_code = user.get('token_code')
        search_limit_raw = config.get(f"SEARCH_LIMIT_{token_code}") if token_code else None

        if search_limit_raw is None:
            # No limit configured by admin → block with a clear message
            raise HTTPException(
                status_code=403,
                detail="No search limit configured for this token. Please contact the admin."
            )

        try:
            search_limit = int(search_limit_raw)
        except (ValueError, TypeError):
            search_limit = 50

        total_searches = int(user.get('total_searches', 0) or 0)
        if total_searches >= search_limit:
            raise HTTPException(
                status_code=429,
                detail=f"Search limit reached ({total_searches}/{search_limit}). Please upgrade your plan to continue."
            )

        return {"status": "paid", "limit": search_limit - total_searches, "tier": user.get('tier')}

    def check_feature(self, user: dict, feature: str):
        """RBAC Gatekeeper evaluating payload access dynamically off Tier metadata"""
        tier = "free" if not user else user.get("tier", "monthly").lower()
        
        # 'weekly' behaves similarly to 'free' but is authenticated
        if tier == "weekly": tier = "free"
        
        permissions = {
            "free": [],
            "daily": ["export", "cma"],
            "monthly": ["export", "cma"],
            "yearly": ["export", "cma", "ai_score", "webhooks", "white_label"],
            "custom": ["export", "cma", "ai_score", "webhooks", "white_label"],
            "pro": ["export", "cma", "ai_score", "webhooks", "white_label"]
        }
        
        if feature not in permissions.get(tier, []):
            raise HTTPException(status_code=403, detail=f"Feature '{feature.upper()}' requires an upgrade. Current tier: {tier.upper()}")
        return True

auth_agent = AuthAgent()
