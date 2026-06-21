"""
database.py — Supabase HTTP REST-backed DBManager
Uses the official supabase-py client which communicates over HTTPS (port 443),
bypassing the AWS/HF Spaces firewall which blocks direct TCP connections on
port 5432 (PostgreSQL).
"""

import os
import json
import re
from datetime import datetime, timedelta
from loguru import logger
import aiohttp
import os
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client, Client

# ─────────────────────────────────────────────────────────────────────
# Supabase HTTP client (uses HTTPS port 443 — never blocked by AWS)
# ─────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set and not empty.")

_client: Client | None = None


# ─────────────────────────────────────────────────────────────────────
# Monkeypatch httpx to Force HTTP/1.1 (Bypass HTTP/2 Multiplexing Drops)
# ─────────────────────────────────────────────────────────────────────
import httpx

_original_client_init = httpx.Client.__init__
def _patched_client_init(self, *args, **kwargs):
    kwargs["http2"] = False
    _original_client_init(self, *args, **kwargs)
httpx.Client.__init__ = _patched_client_init

_original_async_client_init = httpx.AsyncClient.__init__
def _patched_async_client_init(self, *args, **kwargs):
    kwargs["http2"] = False
    _original_async_client_init(self, *args, **kwargs)
httpx.AsyncClient.__init__ = _patched_async_client_init

def get_db() -> Client:
    """Return a cached Supabase client instance."""
    global _client
    if _client is None:
        from supabase import ClientOptions
        # Try to pass ClientOptions just in case, but rely on monkeypatch for http2
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Immediate fallback connection ping to verify credentials and warmup the socket
        try:
            _client.table("admin_config").select("key").limit(1).execute()
            logger.info("Supabase HTTP/1.1 client created and connection verified.")
        except Exception as e:
            logger.error(f"Supabase Connection Ping Failed! Network blocked or invalid credentials: {e}")
            
    return _client


def reset_db():
    """Returns the existing client instance without dropping it. httpx handles reconnects natively."""
    logger.info("Supabase client retry requested, maintaining stable global client.")
    return get_db()


# ─────────────────────────────────────────────────────────────────────
# DBManager
# ─────────────────────────────────────────────────────────────────────

class DBManager:
    def __init__(self, db_path="leads.db", excel_path="Professional_Leads.xlsx"):
        # db_path kept for interface compatibility but ignored
        self.excel_path = excel_path
        self.sb = get_db()
        self.init_db()

    # ------------------------------------------------------------------
    # Schema initialisation — no-op for Supabase (tables must be created
    # manually once in the Supabase SQL Editor using supabase_bootstrap.sql)
    # ------------------------------------------------------------------

    def init_db(self):
        try:
            # Seed admin_config defaults if missing
            existing = self.sb.table("admin_config").select("key").execute()
            existing_keys = {r["key"] for r in (existing.data or [])}
            if "FREE_RESULT_LIMIT" not in existing_keys:
                self.sb.table("admin_config").insert({"key": "FREE_RESULT_LIMIT", "value": "5"}).execute()
            if "TRIAL_ENABLED" not in existing_keys:
                self.sb.table("admin_config").insert({"key": "TRIAL_ENABLED", "value": "true"}).execute()
            logger.info("Database initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")

    # ------------------------------------------------------------------
    # Leads
    # ------------------------------------------------------------------

    def add_lead(self, phone: str, price: str, location: str, url: str,
                 session_id: int = None, intent: str = "seller", description: str = "") -> bool:
        try:
            # ─────────────────────────────────────────────────────────────────
            # Deduplication Layer: Same price + location substring within 24h
            # ─────────────────────────────────────────────────────────────────
            if price and location and price not in ["Buyer Target", "Contact for Price", "N/A", "Unknown"]:
                twenty_four_hours_ago = (datetime.utcnow() - timedelta(hours=24)).isoformat()
                recent_dups = self.sb.table("leads").select("id, location, phone").eq("price", price).gte("timestamp", twenty_four_hours_ago).execute()
                for dup in (recent_dups.data or []):
                    # Exclude the exact same phone number (that's an update, handled by upsert)
                    if dup.get("phone") == phone:
                        continue
                    dup_loc = dup.get("location", "")
                    if dup_loc and (location.lower() in dup_loc.lower() or dup_loc.lower() in location.lower()):
                        logger.info(f"Silently dropped duplicate lead from broker: {price} at {location} (Matches Lead #{dup['id']})")
                        if session_id:
                            try:
                                # Link this duplicate to the current session so stats are accurate
                                self.sb.table("session_leads").insert({"session_id": session_id, "lead_id": dup["id"]}).execute()
                            except Exception:
                                pass
                        return False
            # ─────────────────────────────────────────────────────────────────
            # Upsert by phone (unique)
            payload = {"phone": phone, "price": price, "location": location, "url": url, "intent": intent}
            if session_id:
                payload["session_id"] = session_id

            res = self.sb.table("leads").upsert(
                payload,
                on_conflict="phone", ignore_duplicates=True
            ).execute()

            # Get lead id
            lead_res = self.sb.table("leads").select("id").eq("phone", phone).single().execute()
            if not lead_res.data:
                return False
            lead_id = lead_res.data["id"]

            if session_id:
                try:
                    self.sb.table("session_leads").insert(
                        {"session_id": session_id, "lead_id": lead_id}
                    ).execute()
                except Exception:
                    pass  # Already linked

            logger.success(f"Lead added: {phone}")
            
            # Fire webhook trigger & AI enrichment asynchronously
            import asyncio
            asyncio.create_task(self.check_and_fire_alerts(phone, price, location, url, intent))
            if description and len(description.strip()) > 50:
                asyncio.create_task(self.enrich_lead_with_ai(lead_id, price, location, description))
            
            return True
        except Exception as e:
            logger.error(f"Error adding lead: {e}")
            return False

    async def check_and_fire_alerts(self, phone: str, price: str, location: str, url: str, intent: str):
        try:
            res = self.sb.table("saved_searches").select("*").execute()
            searches = res.data or []
            clean_price = int(re.sub(r'[^\d]', '', price)) if price and re.sub(r'[^\d]', '', price) else 0

            for search in searches:
                if search.get("target_audience") and search["target_audience"] != intent:
                    continue
                if search.get("city") and search["city"].lower() not in location.lower():
                    continue
                if clean_price > 0:
                    if search.get("min_price") and clean_price < search["min_price"]:
                        continue
                    if search.get("max_price") and clean_price > search["max_price"]:
                        continue
                
                # Mock Webhook/Email Trigger Placeholder
                logger.info(f"🚀 [SMART ALERT TRIGGERED] Match for {search['user_email']}: Property found at {location} for {price}. URL: {url}")
        except Exception as e:
            logger.error(f"Error checking alerts: {e}")

    async def enrich_lead_with_ai(self, lead_id: int, price: str, location: str, description: str):
        try:
            gemini_key = os.environ.get("GEMINI_API_KEY", "")
            if not gemini_key: return
            
            prompt = f"""Act as an expert real estate investment AI. Analyze this property in {location} asking for {price}.
Description:
{description[:800]}

Return ONLY a valid JSON object strictly matching this schema exactly:
{{
  "roi_score": 5.5,
  "sentiment": "positive",
  "estimated_value": "5.0M EGP",
  "analysis": "1 short sentence analysis",
  "latitude": 30.0444,
  "longitude": 31.2357
}}"""
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers={'Content-Type': 'application/json'}) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        text_resp = data['candidates'][0]['content']['parts'][0]['text']
                        # Extract JSON from markdown code block if present
                        import re
                        json_match = re.search(r'\\{.*\\}', text_resp.replace('\\n', ' '))
                        if json_match:
                            parsed = json.loads(json_match.group(0))
                            
                            update_payload = {
                                "roi_score": parsed.get("roi_score"),
                                "sentiment": parsed.get("sentiment"),
                                "estimated_value": parsed.get("estimated_value"),
                                "ai_analysis": parsed.get("analysis")
                            }
                            
                            lat = parsed.get("latitude")
                            lng = parsed.get("longitude")
                            if lat and lng:
                                update_payload["geom"] = f"POINT({lng} {lat})"
                                
                            # Update DB
                            self.sb.table("leads").update(update_payload).eq("id", lead_id).execute()
                            logger.info(f"✨ AI Enrichment completed for Lead #{lead_id} (ROI: {parsed.get('roi_score')})")
        except Exception as e:
            logger.error(f"Failed to enrich lead #{lead_id} with Gemini: {e}")

    def export_data(self, session_id: int = None, fmt="excel"):
        try:
            import pandas as pd
            import io
            if session_id:
                sl = self.sb.table("session_leads").select("lead_id").eq("session_id", session_id).execute()
                ids = [r["lead_id"] for r in (sl.data or [])]
                if not ids:
                    return None
                res = self.sb.table("leads").select("*").in_("id", ids).execute()
            else:
                res = self.sb.table("leads").select("*").execute()
                
            rows = res.data or []
            if not rows: return None
            
            df = pd.DataFrame(rows)
            df = df.rename(columns={
                "phone": "Contact Number",
                "price": "Market Price",
                "location": "Target Location",
                "url": "Origin Source Link",
                "intent": "Lead Type",
                "timestamp": "Scraped At (UTC)"
            })
            if "id" in df.columns: df = df.drop(columns=["id", "session_id"], errors='ignore')
            
            if fmt == "csv":
                output = io.StringIO()
                df.to_csv(output, index=False)
                return output.getvalue().encode('utf-8')
            else:
                output = io.BytesIO()
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    df.to_excel(writer, index=False, sheet_name='PropPulse_Leads')
                return output.getvalue()
        except Exception as e:
            logger.error(f"Failed to export data: {e}")
            return None

    def get_all_leads(self, session_id: int = None):
        try:
            if session_id:
                sl = self.sb.table("session_leads").select("lead_id").eq("session_id", session_id).execute()
                ids = [r["lead_id"] for r in (sl.data or [])]
                if not ids:
                    return []
                res = self.sb.table("leads").select("*").in_("id", ids).order("timestamp", desc=True).execute()
            else:
                res = self.sb.table("leads").select("*").order("timestamp", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error retrieving leads: {e}")
            return []

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    def create_session(self, city: str, property_type: str,
                       time_filter: str, target_audience: str = "sellers",
                       user_id: str = None, user_email: str = None):
        try:
            payload = {
                "city": city, "property_type": property_type,
                "time_filter": time_filter, "target_audience": target_audience
            }
            if user_id:
                payload["user_id"] = user_id
            if user_email:
                payload["user_email"] = user_email
            res = self.sb.table("search_sessions").insert(payload).execute()
            return res.data[0]["id"] if res.data else None
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            return None

    # ------------------------------------------------------------------
    # Saved Searches (Smart Alerts)
    # ------------------------------------------------------------------

    def create_saved_search(self, user_email: str, city: str, min_price: int, max_price: int, property_type: str, target_audience: str):
        try:
            res = self.sb.table("saved_searches").insert({
                "user_email": user_email,
                "city": city,
                "min_price": min_price,
                "max_price": max_price,
                "property_type": property_type,
                "target_audience": target_audience
            }).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Failed to create saved search: {e}")
            return None

    def get_saved_searches(self, user_email: str):
        try:
            res = self.sb.table("saved_searches").select("*").eq("user_email", user_email).order("created_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Failed to fetch saved searches: {e}")
            return []

    def get_sessions(self, user_id: str = None):
        try:
            query = self.sb.table("search_sessions").select("*").order("created_at", desc=True)
            # If user_id provided, scope results to that user only (multi-tenant isolation)
            if user_id:
                query = query.eq("user_id", user_id)
            res = query.execute()
            sessions = res.data or []
            for s in sessions:
                sl = self.sb.table("session_leads").select("lead_id", count="exact").eq("session_id", s["id"]).execute()
                s["lead_count"] = sl.count or 0
            return sessions
        except Exception as e:
            logger.error(f"Error retrieving sessions: {e}")
            return []

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def get_stats(self):
        try:
            import pandas as pd
            res = self.sb.table("leads").select("phone, price").execute()
            rows = res.data or []
            total_leads = len(rows)
            verified_phones = sum(1 for r in rows if r.get("phone"))

            def clean_price(p):
                m = re.sub(r'[^\d]', '', str(p)) if p else ''
                return int(m) if m else None

            prices = [clean_price(r.get("price")) for r in rows]
            prices = [p for p in prices if p is not None]
            avg_price = sum(prices) / len(prices) if prices else 0.0

            return {"total_leads": total_leads, "verified_phones": verified_phones, "avg_price": avg_price}
        except Exception as e:
            logger.error(f"Error fetching stats: {e}")
            return {"total_leads": 0, "verified_phones": 0, "avg_price": 0.0}

    # ------------------------------------------------------------------
    # Admin Config
    # ------------------------------------------------------------------

    def get_admin_config(self):
        try:
            res = self.sb.table("admin_config").select("key, value").execute()
            config = {}
            for row in (res.data or []):
                key, value = row["key"], row["value"]
                if value.lower() in ('true', 'false'):
                    config[key] = value.lower() == 'true'
                else:
                    try:
                        config[key] = json.loads(value)
                    except Exception:
                        try:
                            config[key] = int(value)
                        except ValueError:
                            config[key] = value
            return config
        except Exception as e:
            logger.error(f"Error fetching admin config: {e}")
            return {}

    def update_admin_config(self, key, value) -> bool:
        try:
            val_str = ('true' if value else 'false') if isinstance(value, bool) \
                else json.dumps(value) if isinstance(value, (dict, list)) \
                else str(value)
            self.sb.table("admin_config").upsert({"key": key, "value": val_str}).execute()
            return True
        except Exception as e:
            logger.error(f"Error updating admin config {key}: {e}")
            return False

    # ------------------------------------------------------------------
    # SaaS: Tokens
    # ------------------------------------------------------------------

    def create_token(self, token_code: str, tier: str, expires_at: str) -> bool:
        try:
            self.sb.table("tokens").insert({
                "token_code": token_code, "tier": tier, "expires_at": expires_at
            }).execute()
            return True
        except Exception as e:
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                logger.warning(f"Token {token_code} already exists.")
                return False
            logger.error(f"Error creating token: {e}")
            return False

    def get_token(self, token_code: str):
        try:
            res = self.sb.table("tokens").select("*").eq("token_code", token_code).single().execute()
            return res.data
        except Exception as e:
            logger.error(f"Error fetching token: {e}")
            return None

    def get_all_tokens(self):
        try:
            res = self.sb.table("tokens").select("*").order("created_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching tokens: {e}")
            return []

    # ------------------------------------------------------------------
    # SaaS: Users
    # ------------------------------------------------------------------

    def get_user_by_email(self, email: str):
        try:
            res = self.sb.table("users").select("*").eq("email", email).maybe_single().execute()
            return res.data
        except Exception as e:
            logger.error(f"Error fetching user by email: {e}")
            return None

    def get_user_by_session(self, session_key: str):
        for attempt in range(2):
            try:
                res = self.sb.table("users").select("*").eq("session_key", session_key).maybe_single().execute()
                if not res or not hasattr(res, 'data') or not res.data:
                    return None
                user = dict(res.data)
                
                token_info = {}
                if user.get("token_id"):
                    t_res = self.sb.table("tokens").select("tier, expires_at, token_code").eq("id", user["token_id"]).maybe_single().execute()
                    if t_res and hasattr(t_res, 'data') and t_res.data:
                        token_info = t_res.data
                        
                user.update(token_info)
                return user
            except Exception as e:
                logger.error(f"Error fetching user by session (attempt {attempt+1}): {e}")
                if attempt == 0:
                    # Supabase/httpx handles transient drops natively; just pause and retry
                    import asyncio
                    try:
                        loop = asyncio.get_running_loop()
                        # Can't use await here because get_user_by_session is sync
                        import time
                        time.sleep(0.5)
                    except RuntimeError:
                        import time
                        time.sleep(0.5)
                    self.sb = get_db()
                else:
                    return None

    def get_all_users(self):
        try:
            res = self.sb.table("users").select("id, email, ip_address, session_key, total_searches, created_at, token_id").order("created_at", desc=True).execute()
            users = res.data or []
            
            # Fetch all tokens to join manually
            t_res = self.sb.table("tokens").select("id, token_code, tier, expires_at, is_active").execute()
            tokens_map = {t["id"]: t for t in (t_res.data or [])}
            
            final_users = []
            for u in users:
                user_dict = dict(u)
                t_id = user_dict.get("token_id")
                if t_id and t_id in tokens_map:
                    t_info = tokens_map[t_id].copy()
                    t_info.pop("id", None)
                    user_dict.update(t_info)
                final_users.append(user_dict)
                
            return final_users
        except Exception as e:
            logger.error(f"Error fetching all users: {e}")
            return []

    def revoke_previous_sessions(self, token_id: int):
        """Revokes all previous active sessions for a given token (Single-Device Enforcement)."""
        self.sb.table("auth_sessions").delete().eq("token_id", token_id).execute()

    def bind_token_to_session(self, token_id: int, session_key: str,
                              ip_address: str, email: str = None, max_users: int = 1) -> bool:
        """Binds a device session to a token, enforcing Single-Device or Company limits."""
        try:
            res = self.sb.table("users").select("*").eq("token_id", token_id).execute()
            users = res.data or []
            
            # Match either by exact IP, OR if it's the dummy "admin-minted" IP
            existing_user = next((u for u in users if u.get('ip_address') in (ip_address, "admin-minted")), None)
            
            # For single-user tokens, ALWAYS allow overriding the previous session (Standard SaaS behavior)
            # This handles dynamic IPs and Vercel IP rotation by logging out the old session.
            if max_users == 1 and users and not existing_user:
                existing_user = users[0]
            
            if existing_user:
                # Update the session & IP
                payload = {"session_key": session_key, "ip_address": ip_address}
                if email: payload["email"] = email
                self.sb.table("users").update(payload).eq("id", existing_user["id"]).execute()
            elif len(users) < max_users:
                # Not reached limit, add new device
                payload = {"token_id": token_id, "session_key": session_key, "ip_address": ip_address}
                if email: payload["email"] = email
                self.sb.table("users").insert(payload).execute()
            else:
                # Limit reached, throw error to bounce them out instead of overwriting someone else
                raise ValueError(f"Maximum device limit ({max_users}) reached for this token.")
                
            self.sb.table("tokens").update({"used_by": token_id}).eq("id", token_id).execute()
            return True
        except Exception as e:
            logger.error(f"FATAL Error binding token to session: {e}")
            raise ValueError(f"Supabase Backend Reject: {e}")

    def bind_token_to_email(self, token_code: str, email: str, session_key: str) -> bool:
        try:
            token_res = self.sb.table("tokens").select("id").eq("token_code", token_code).single().execute()
            if not token_res.data:
                return False
            token_id = token_res.data["id"]
            self.sb.table("users").upsert({
                "email": email, "token_id": token_id,
                "session_key": session_key, "ip_address": "admin-minted"
            }, on_conflict="session_key", ignore_duplicates=True).execute()
            return True
        except Exception as e:
            logger.error(f"Error pre-binding email {email} to token: {e}")
            return False

    def increment_user_searches(self, user_id: int) -> bool:
        try:
            # Supabase doesn't support relative updates via REST directly; use RPC
            user = self.sb.table("users").select("total_searches").eq("id", user_id).single().execute()
            if user.data:
                new_count = (user.data.get("total_searches") or 0) + 1
                self.sb.table("users").update({"total_searches": new_count}).eq("id", user_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error incrementing searches: {e}")
            return False

    # ------------------------------------------------------------------
    # Free-tier rate limiting
    # ------------------------------------------------------------------

    def get_free_usage_remaining(self, ip_address: str, daily_limit: int) -> int:
        try:
            res = self.sb.table("free_usage").select("leads_extracted, last_reset").eq("ip_address", ip_address).maybe_single().execute()
            if not res or not hasattr(res, 'data') or not res.data:
                return daily_limit
            leads_extracted = res.data.get("leads_extracted", 0)
            
            # Handle possible missing last_reset gracefully
            last_reset_str = res.data.get("last_reset")
            if not last_reset_str:
                return daily_limit
                
            last_reset = datetime.fromisoformat(last_reset_str.replace("Z", "+00:00")).replace(tzinfo=None)
            if datetime.utcnow() - last_reset >= timedelta(hours=24):
                self.sb.table("free_usage").update({"leads_extracted": 0, "last_reset": datetime.utcnow().isoformat()}).eq("ip_address", ip_address).execute()
                return daily_limit
            return max(0, daily_limit - leads_extracted)
        except Exception as e:
            logger.error(f"Error checking free usage: {e}")
            return daily_limit

    def increment_free_usage(self, ip_address: str):
        try:
            existing = self.sb.table("free_usage").select("leads_extracted").eq("ip_address", ip_address).maybe_single().execute()
            if existing and hasattr(existing, 'data') and existing.data:
                new_count = (existing.data.get("leads_extracted") or 0) + 1
                self.sb.table("free_usage").update({"leads_extracted": new_count}).eq("ip_address", ip_address).execute()
            else:
                self.sb.table("free_usage").insert({"ip_address": ip_address, "leads_extracted": 1}).execute()
        except Exception as e:
            logger.error(f"Error incrementing free usage: {e}")

    # ------------------------------------------------------------------
    # Analytics
    # ------------------------------------------------------------------

    def get_analytics(self, session_id: int = None):
        try:
            import pandas as pd
            if session_id:
                sl = self.sb.table("session_leads").select("lead_id").eq("session_id", session_id).execute()
                ids = [r["lead_id"] for r in (sl.data or [])]
                if not ids:
                    return {"intent_distribution": {}, "location_distribution": {}, "avg_price": 0.0, "total": 0}
                res = self.sb.table("leads").select("intent, location, price").in_("id", ids).execute()
            else:
                res = self.sb.table("leads").select("intent, location, price").execute()

            rows = res.data or []
            if not rows:
                return {"intent_distribution": {}, "location_distribution": {}, "avg_price": 0.0, "total": 0}

            df = pd.DataFrame(rows)
            intent_dist = df['intent'].value_counts().to_dict()
            location_dist = df['location'].value_counts().head(10).to_dict()

            def clean(p):
                m = re.sub(r'[^\d]', '', str(p)) if p else ''
                return int(m) if m else None

            df['price_num'] = df['price'].apply(clean)
            prices = df['price_num'].dropna()
            avg = float(prices.mean()) if len(prices) > 0 else 0.0

            return {"intent_distribution": intent_dist, "location_distribution": location_dist, "avg_price": avg, "total": len(rows)}
        except Exception as e:
            logger.error(f"Error fetching analytics: {e}")
            return {"intent_distribution": {}, "location_distribution": {}, "avg_price": 0.0, "total": 0}
