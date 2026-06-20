-- ============================================================
-- UREI Scraper: Multi-Tenant Data Isolation Migration
-- Run this ONCE in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add user ownership columns to search_sessions
ALTER TABLE search_sessions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE search_sessions ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2. Index for fast per-user queries (prevents full table scans)
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON search_sessions(user_id);

-- ============================================================
-- After running this, deploy your updated backend + frontend.
-- New scrape sessions will be tagged with the user's ID.
-- Old sessions (from before this migration) will have user_id = NULL
-- and will NOT appear in any user's dashboard (clean slate).
-- ============================================================
