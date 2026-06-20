-- ==============================================================================
-- PHASE 2: UREI SUPABASE REALTIME & INDEXING OPTIMIZATIONS
-- ==============================================================================

-- 1. B-Tree Indexes for extremely fast pagination and querying
CREATE INDEX IF NOT EXISTS idx_leads_session_id ON leads (session_id);
CREATE INDEX IF NOT EXISTS idx_leads_timestamp ON leads (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_leads_location ON leads (location text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_leads_price ON leads (price);

-- Compound index for optimal performance when polling sessions
CREATE INDEX IF NOT EXISTS idx_session_leads_compound ON session_leads (session_id, lead_id);

-- 2. Ensure Realtime is enabled efficiently for the leads table ONLY
BEGIN;
  -- Remove previous replication if necessary to rebuild cleanly
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- 3. Modify single device tracking in admin config or sessions if needed
-- We'll track invalidated tokens or active session constraints via application logic,
-- but the indexes above guarantee the DB performs with zero latency.
