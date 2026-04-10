"""
Force-create all PropPulse SaaS tables in Supabase PostgreSQL.
Run this once from your local machine to bootstrap the remote schema.
"""
import psycopg2
from psycopg2 import extras

DSN = {
    "host": "db.uzdhrsfuzrumfglpuckz.supabase.co",
    "port": 5432,
    "dbname": "postgres",
    "user": "postgres",
    "password": "HDKE_5.2P@2.J!i",
    "connect_timeout": 15,
    "sslmode": "require"
}

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS leads (
    id          SERIAL PRIMARY KEY,
    phone       TEXT UNIQUE,
    price       TEXT,
    location    TEXT,
    url         TEXT,
    intent      TEXT DEFAULT 'seller',
    session_id  INTEGER,
    timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_sessions (
    id              SERIAL PRIMARY KEY,
    city            TEXT,
    property_type   TEXT,
    time_filter     TEXT,
    target_audience TEXT DEFAULT 'sellers',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_leads (
    session_id  INTEGER,
    lead_id     INTEGER,
    PRIMARY KEY (session_id, lead_id)
);

CREATE TABLE IF NOT EXISTS free_usage (
    ip_address      TEXT PRIMARY KEY,
    leads_extracted INTEGER DEFAULT 0,
    last_reset      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tokens (
    id          SERIAL PRIMARY KEY,
    token_code  TEXT UNIQUE,
    tier        TEXT,
    expires_at  TIMESTAMP,
    used_by     INTEGER DEFAULT 0,
    user_id     INTEGER,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           TEXT,
    token_id        INTEGER,
    session_key     TEXT UNIQUE,
    total_searches  INTEGER DEFAULT 0,
    ip_address      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_config (
    key   TEXT PRIMARY KEY,
    value TEXT
);

INSERT INTO admin_config (key, value) VALUES ('FREE_RESULT_LIMIT', '5')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_config (key, value) VALUES ('TRIAL_ENABLED', 'true')
ON CONFLICT (key) DO NOTHING;
"""

print("Connecting to Supabase...")
try:
    conn = psycopg2.connect(**DSN)
    conn.autocommit = True
    cur = conn.cursor()
    print("Connected! Creating schema...")
    cur.execute(SCHEMA_SQL)
    print("Schema created successfully!")

    # Verify tables exist
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    print(f"Tables in public schema: {tables}")

    # Verify admin_config seeded
    cur.execute("SELECT key, value FROM admin_config")
    config = cur.fetchall()
    print(f"Admin config: {config}")

    conn.close()
    print("DONE.")
except Exception as e:
    print(f"ERROR: {e}")
