import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
from loguru import logger
import os
import json
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("FATAL: DATABASE_URL environment variable must be set.")

class DBManager:
    def __init__(self, excel_path="Professional_Leads.xlsx"):
        self.db_url = DATABASE_URL
        self.excel_path = excel_path
        self.init_db()

    def get_connection(self):
        return psycopg2.connect(self.db_url)

    def init_db(self):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    # Leads table 
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS leads (
                            id SERIAL PRIMARY KEY,
                            url TEXT,
                            phone TEXT,
                            whatsapp TEXT,
                            title TEXT,
                            price TEXT,
                            location TEXT,
                            description TEXT,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            target_audience TEXT DEFAULT 'sellers',
                            UNIQUE(phone, url)
                        )
                    ''')

                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS search_sessions (
                            id SERIAL PRIMARY KEY,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            city TEXT,
                            property_type TEXT,
                            time_filter TEXT,
                            target_audience TEXT DEFAULT 'sellers'
                        )
                    ''')
                    
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS free_usage (
                            ip_address TEXT PRIMARY KEY,
                            leads_extracted INTEGER DEFAULT 0,
                            last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    ''')

                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS session_leads (
                            session_id INTEGER,
                            lead_id INTEGER,
                            UNIQUE(session_id, lead_id)
                        )
                    ''')
                    
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS tokens (
                            id SERIAL PRIMARY KEY,
                            token_code TEXT UNIQUE,
                            tier TEXT,
                            expires_at TIMESTAMP,
                            used_by TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            is_active INTEGER DEFAULT 1
                        )
                    ''')
                    
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS users (
                            id SERIAL PRIMARY KEY,
                            token_id INTEGER,
                            ip_address TEXT,
                            session_key TEXT UNIQUE,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            total_searches INTEGER DEFAULT 0,
                            email TEXT
                        )
                    ''')
                    
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS admin_config (
                            key TEXT UNIQUE,
                            value TEXT
                        )
                    ''')
                conn.commit()
            logger.info("Supabase PostgreSQL Database initialized with SaaS schema.")
        except Exception as e:
            logger.error(f"Error initializing Supabase PostgreSQL: {e}")

    def create_search_session(self, criteria: dict):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO search_sessions (city, property_type, time_filter, target_audience)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                    ''', (
                        criteria.get('city', ''),
                        criteria.get('property_type', ''),
                        criteria.get('time_filter', ''),
                        criteria.get('target_audience', 'sellers')
                    ))
                    session_id = cursor.fetchone()[0]
                conn.commit()
                return session_id
        except Exception as e:
            logger.error(f"Error creating search session: {e}")
            return None

    def add_lead(self, session_id: int, lead_data: dict) -> bool:
        if not lead_data.get('phone') and not lead_data.get('whatsapp'):
            return False
            
        phone = lead_data.get('phone') or lead_data.get('whatsapp')
        url = lead_data.get('url')
        location = lead_data.get('location', '')
        
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    try:
                        cursor.execute('''
                            INSERT INTO leads (url, phone, whatsapp, title, price, location, description, target_audience)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            RETURNING id
                        ''', (
                            url, phone,
                            lead_data.get('whatsapp'), lead_data.get('title'),
                            lead_data.get('price'), location,
                            lead_data.get('description'),
                            lead_data.get('target_audience', 'sellers')
                        ))
                        lead_id = cursor.fetchone()[0]
                    except psycopg2.IntegrityError:
                        conn.rollback()
                        cursor.execute("SELECT id FROM leads WHERE phone = %s AND url = %s", (phone, url))
                        res = cursor.fetchone()
                        if res:
                            lead_id = res[0]
                        else:
                            return False
                    
                    try:
                        cursor.execute('''
                            INSERT INTO session_leads (session_id, lead_id)
                            VALUES (%s, %s)
                        ''', (session_id, lead_id))
                        is_new = True
                    except psycopg2.IntegrityError:
                        conn.rollback()
                        is_new = False
                        
                conn.commit()
                if is_new:
                    self.export_to_excel(session_id)
                    logger.success(f"New lead added/linked to session {session_id}: {phone} at {location}")
                    return True
                else:
                    return False
        except Exception as e:
            logger.error(f"Error adding lead: {e}")
            return False

    def export_to_excel(self, session_id: int = None):
        try:
            url = self.db_url
            if session_id:
                df = pd.read_sql_query(f'''
                    SELECT l.* FROM leads l
                    JOIN session_leads sl ON l.id = sl.lead_id
                    WHERE sl.session_id = {session_id}
                    ORDER BY l.timestamp DESC
                ''', url)
                path = f"Search_Session_{session_id}.xlsx"
                df.to_excel(path, index=False)
            else:
                df = pd.read_sql_query("SELECT * FROM leads", url)
                df.to_excel(self.excel_path, index=False)
            logger.info(f"Data auto-exported to Excel session_id={session_id}")
        except Exception as e:
            logger.error(f"Failed to export to excel: {e}")

    def get_all_leads(self, session_id: int = None):
        try:
            url = self.db_url
            if session_id:
                df = pd.read_sql_query(f'''
                    SELECT l.* FROM leads l
                    JOIN session_leads sl ON l.id = sl.lead_id
                    WHERE sl.session_id = {session_id}
                    ORDER BY l.timestamp DESC
                ''', url)
            else:
                df = pd.read_sql_query("SELECT * FROM leads ORDER BY timestamp DESC", url)
            return df.to_dict(orient='records')
        except Exception as e:
            logger.error(f"Failed to get leads: {e}")
            return []

    def get_session_details(self, session_id: int):
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute("SELECT * FROM search_sessions WHERE id = %s", (session_id,))
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting session details: {e}")
            return None

    def get_search_history(self):
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute('''
                        SELECT s.id, s.timestamp, s.city, s.property_type, s.time_filter, s.target_audience,
                               COUNT(sl.lead_id) as lead_count
                        FROM search_sessions s
                        LEFT JOIN session_leads sl ON s.id = sl.session_id
                        GROUP BY s.id
                        ORDER BY s.timestamp DESC
                        LIMIT 50
                    ''')
                    rows = cursor.fetchall()
                    return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting search history: {e}")
            return []

    def get_global_stats(self):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT COUNT(*) FROM leads")
                    total_leads = cursor.fetchone()[0] or 0
                    
                    cursor.execute("SELECT COUNT(DISTINCT phone) FROM leads WHERE phone IS NOT NULL AND phone != ''")
                    verified_phones = cursor.fetchone()[0] or 0
                    
                    cursor.execute("SELECT AVG(CAST(REGEXP_REPLACE(price, '[^0-9]', '', 'g') AS NUMERIC)) FROM leads WHERE price IS NOT NULL AND price != '' AND REGEXP_REPLACE(price, '[^0-9]', '', 'g') != ''")
                    avg_price_row = cursor.fetchone()
                    # Catch Nulls correctly
                    avg_price = float(avg_price_row[0]) if avg_price_row and avg_price_row[0] else 0
                    
                    return {
                        "total_leads": total_leads,
                        "verified_phones": verified_phones,
                        "avg_price": round(avg_price, 2)
                    }
        except Exception as e:
            logger.error(f"Error getting global stats: {e}")
            return {"total_leads": 0, "verified_phones": 0, "avg_price": 0}

    # --- SaaS Admin Methods ---
    def get_admin_config(self):
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute("SELECT * FROM admin_config")
                    rows = cursor.fetchall()
                    config = {}
                    for row in rows:
                        try:
                            # Try to parse boolean/num if it's JSON
                            val = json.loads(row['value'])
                        except:
                            val = row['value']
                        config[row['key']] = val
                    return config
        except Exception as e:
            logger.error(f"Error getting config: {e}")
            return {}

    def update_admin_config(self, key: str, value):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    if isinstance(value, (bool, list, dict, int, float)):
                        val_str = json.dumps(value)
                    else:
                        val_str = str(value)
                    
                    cursor.execute('''
                        INSERT INTO admin_config (key, value)
                        VALUES (%s, %s)
                        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                    ''', (key, val_str))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error updating admin config {key}: {e}")
            return False

    def create_token(self, token_code: str, tier: str, expires_at: str) -> bool:
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO tokens (token_code, tier, expires_at)
                        VALUES (%s, %s, %s)
                    ''', (token_code, tier, expires_at))
                conn.commit()
                return True
        except psycopg2.IntegrityError:
            logger.warning(f"Token {token_code} already exists.")
            return False
        except Exception as e:
            logger.error(f"Error creating token: {e}")
            return False

    def get_token(self, token_code: str):
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute("SELECT * FROM tokens WHERE token_code = %s", (token_code,))
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error fetching token: {e}")
            return None

    def get_user_by_email(self, email: str):
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error fetching user by email: {e}")
            return None

    def get_free_usage_remaining(self, ip_address: str, daily_limit: int) -> int:
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT leads_extracted, last_reset FROM free_usage WHERE ip_address = %s", (ip_address,))
                    row = cursor.fetchone()
                    if not row:
                        return daily_limit
                    
                    leads_extracted, last_reset = row
                    
                    # Convert to naïve UTC datetime if postgres returns timezone aware
                    if isinstance(last_reset, datetime):
                         last_reset_date = last_reset.replace(tzinfo=None)
                    else:
                         last_reset_date = datetime.fromisoformat(str(last_reset))
                    
                    # If 24 hours have passed, reset quota
                    if datetime.utcnow() - last_reset_date >= timedelta(hours=24):
                        cursor.execute("UPDATE free_usage SET leads_extracted = 0, last_reset = CURRENT_TIMESTAMP WHERE ip_address = %s", (ip_address,))
                        conn.commit()
                        return daily_limit
                    
                    return max(0, daily_limit - leads_extracted)
        except Exception as e:
            logger.error(f"Error checking free usage: {e}")
            return daily_limit

    def increment_free_usage(self, ip_address: str):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO free_usage (ip_address, leads_extracted)
                        VALUES (%s, 1)
                        ON CONFLICT (ip_address) DO UPDATE SET 
                        leads_extracted = free_usage.leads_extracted + 1
                    ''', (ip_address,))
                conn.commit()
        except Exception as e:
            logger.error(f"Error incrementing free usage: {e}")

    def get_user_by_session(self, session_key: str):
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute('''
                        SELECT u.*, t.tier, t.expires_at, t.token_code 
                        FROM users u 
                        LEFT JOIN tokens t ON u.token_id = t.id 
                        WHERE u.session_key = %s
                    ''', (session_key,))
                    row = cursor.fetchone()
                    # Ensure datetime fields are converted to strings so downstream JSON works
                    if row:
                        row_dict = dict(row)
                        if isinstance(row_dict.get('expires_at'), datetime):
                            row_dict['expires_at'] = row_dict['expires_at'].isoformat()
                        if isinstance(row_dict.get('created_at'), datetime):
                            row_dict['created_at'] = row_dict['created_at'].isoformat()
                        return row_dict
                    return None
        except Exception as e:
            logger.error(f"Error getting user by session: {e}")
            return None

    def create_user_session(self, token_id: int, ip_address: str, session_key: str, email: str = None) -> bool:
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO users (token_id, ip_address, session_key, email)
                        VALUES (%s, %s, %s, %s)
                    ''', (token_id, ip_address, session_key, email))
                    
                    cursor.execute('''
                        UPDATE tokens SET used_by = %s WHERE id = %s
                    ''', (ip_address, token_id))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error creating user session: {e}")
            return False

    def increment_user_searches(self, session_key: str):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        UPDATE users SET total_searches = total_searches + 1
                        WHERE session_key = %s
                    ''', (session_key,))
                conn.commit()
        except Exception as e:
            logger.error(f"Error incrementing user searches: {e}")

    def get_all_users(self):
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute('''
                        SELECT u.email, u.ip_address, u.total_searches, u.created_at,
                               t.token_code, t.tier, t.expires_at, t.is_active
                        FROM users u
                        LEFT JOIN tokens t ON u.token_id = t.id
                        ORDER BY u.created_at DESC
                    ''')
                    rows = cursor.fetchall()
                    data = []
                    for row in rows:
                        d = dict(row)
                        if isinstance(d.get('expires_at'), datetime):
                            d['expires_at'] = d['expires_at'].isoformat()
                        if isinstance(d.get('created_at'), datetime):
                            d['created_at'] = d['created_at'].isoformat()
                        data.append(d)
                    return data
        except Exception as e:
            logger.error(f"Error getting all users: {e}")
            return []
