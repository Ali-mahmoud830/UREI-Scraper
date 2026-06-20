import os
import asyncio
from datetime import datetime
from loguru import logger
from database import DBManager

async def run_maintenance():
    """
    Serverless Chron-Job / Watchdog Hook
    Executes a sweep on the active token ecosystem and automatically revokes
    access for any license passing the 00:00 UTC cutoff boundary.
    """
    logger.info("Starting automated Daily Cron Maintenance sweep...")
    db = DBManager()
    
    utc_now = datetime.utcnow()
    
    # Fetch all supposedly 'active' licenses securely
    try:
        active_tokens = db.sb.table("tokens").select("*").eq("is_active", 1).execute()
    except Exception as e:
        logger.error(f"Failed to fetch active tokens list: {e}")
        return
    
    if not active_tokens.data:
        logger.info("No active users to prune in the ecosystem.")
        return
        
    expired_count = 0
    for token in active_tokens.data:
        if token.get('expires_at'):
            try:
                # Strip out possible localized Z or +00:00 timestamps to match Python mathematical raw offsets
                raw_exp = str(token['expires_at']).replace("Z", "+00:00")
                expires_at = datetime.fromisoformat(raw_exp).replace(tzinfo=None)
                
                if utc_now >= expires_at:
                    logger.info(f"License Key {token['token']} surpassed expiration boundary natively. Deactivating...")
                    db.sb.table("tokens").update({"is_active": 0}).eq("token", token['token']).execute()
                    expired_count += 1
            except Exception as parse_error:
                logger.warning(f"Failed to parse or deactivate token {token.get('token')}: {parse_error}")
                
    logger.success(f"Maintenance Pipeline Complete. Enforced deactivation on {expired_count} expired licenses securely.")

if __name__ == "__main__":
    asyncio.run(run_maintenance())
