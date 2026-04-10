import secrets
import string
from datetime import datetime, timedelta
import logging
import jwt
from jwt.exceptions import PyJWTError as JWTError
from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import DBManager

logger = logging.getLogger(__name__)

# JWT Config (in production, use environment variables)
SECRET_KEY = "prop_pulse_super_secret_key!@#123"
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)

class AuthAgent:
    """Layer 2 - Orchestration: Manages Auth, Tokens and Session Watchdog"""
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
        """Creates a JWT for authenticated sessions — binds to origin IP + User-Agent fingerprint"""
        session_key = secrets.token_urlsafe(32)
        expire = datetime.utcnow() + timedelta(days=self.token_expiry.get(token_data['tier'].lower(), 30))
        
        # Bind session in DB (Watchdog logic)
        self.db.bind_token_to_session(token_data['id'], session_key, ip_address)
        
        to_encode = {
            "sub": session_key,
            "exp": expire,
            "tier": token_data['tier'],
            "device": user_agent[:80]  # Store abbreviated fingerprint inside JWT payload
        }
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    def redeem_token(self, token_code: str, ip_address: str) -> str:
        """Redeem a token and return a JWT if valid"""
        token = self.db.get_token(token_code)
        
        if not token:
            raise HTTPException(status_code=404, detail="Invalid token")
            
        if token['used_by']:
            raise HTTPException(status_code=403, detail="Token already used by another device")
            
        if not token['is_active']:
            raise HTTPException(status_code=403, detail="Token has been deactivated")
            
        expires_at = datetime.fromisoformat(token['expires_at'])
        if datetime.utcnow() > expires_at:
            raise HTTPException(status_code=403, detail="Token has expired")
            
        return self.create_session_jwt(token, ip_address)

    def get_current_user(self, credentials: HTTPAuthorizationCredentials = Security(security)):
        """Watchdog Agent: Validates incoming requests by checking their JWT and session binding"""
        if not credentials:
            return None
            
        token = credentials.credentials
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            session_key: str = payload.get("sub")
            if session_key is None:
                raise HTTPException(status_code=401, detail="Invalid session credentials")
        except JWTError:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
            
        user = self.db.get_user_by_session(session_key)
        if user is None:
            raise HTTPException(status_code=401, detail="Session not found or revoked")
            
        # Check token expiry from DB to ensure it hasn't expired since JWT issue
        if user['expires_at']:
            # Force replace Z to fix python parsing of isoformat
            expires_at = datetime.fromisoformat(str(user['expires_at']).replace("Z", "+00:00"))
            # Make utcnow naive or timezone aware to match
            utc_now = datetime.utcnow()
            if expires_at.tzinfo is not None:
                utc_now = utc_now.replace(tzinfo=expires_at.tzinfo)
            if utc_now > expires_at:
                raise HTTPException(status_code=403, detail="Subscription expired")
                
        return user

    def get_user_from_query(self, token: str = None):
        """Used for raw GET endpoints (like exports) where Authorization Headers aren't possible (e.g. window.location.href)"""
        if not token:
            return None
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            session_key = payload.get("sub")
            if not session_key: return None
            
            user = self.db.get_user_by_session(session_key)
            if user and user.get('expires_at'):
                expires_at = datetime.fromisoformat(str(user['expires_at']).replace("Z", "+00:00"))
                utc_now = datetime.utcnow()
                if expires_at.tzinfo is not None:
                    utc_now = utc_now.replace(tzinfo=expires_at.tzinfo)
                if utc_now > expires_at:
                    return None
            return user
        except JWTError:
            return None

    def enforce_rate_limits(self, user: dict = None, ip_address: str = None):
        """Search Coordinator: Checks if user can perform a search based on config/tier"""
        config = self.db.get_admin_config()
        trial_enabled = config.get("TRIAL_ENABLED", True)
        
        # Convert config value to integer safely
        try:
            free_limit = int(config.get("FREE_RESULT_LIMIT", 50))
        except (ValueError, TypeError):
            free_limit = 50
        
        if user is None:
            # Unauthenticated user
            if not trial_enabled:
                raise HTTPException(status_code=403, detail="Trials are currently disabled. Please enter a license token.")
                
            if ip_address:
                remaining = self.db.get_free_usage_remaining(ip_address, free_limit)
                if remaining <= 0:
                    raise HTTPException(status_code=429, detail=f"Daily trial limit ({free_limit} leads) reached. Please check back tomorrow or unlock Elite.")
            else:
                remaining = free_limit
                
            return {"status": "trial", "limit": remaining, "ip_address": ip_address}
            
        # Authenticated user
        # User gets unlimited results if they have a valid token
        return {"status": "paid", "limit": None, "tier": user.get('tier')}

    def check_feature(self, user: dict, feature: str):
        """RBAC Gatekeeper evaluating payload access dynamically off Tier metadata"""
        tier = "free" if not user else user.get("tier", "monthly").lower()
        
        # 'weekly' behaves similarly to 'free' but is authenticated
        if tier == "weekly": tier = "free"
        
        permissions = {
            "free": [],
            "monthly": ["export", "cma"],
            "pro": ["export", "cma", "ai_score", "webhooks", "white_label"]
        }
        
        if feature not in permissions.get(tier, []):
            raise HTTPException(status_code=403, detail=f"Feature '{feature.upper()}' requires an upgrade. Current tier: {tier.upper()}")
        return True

auth_agent = AuthAgent()
