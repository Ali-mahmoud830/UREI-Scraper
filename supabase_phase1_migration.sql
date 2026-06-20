-- ============================================================
-- UREI Scraper: Phase 1 Foundation Hardening Migration
-- Run this ONCE in your Supabase SQL Editor
-- ============================================================

-- 1. Enable PostGIS Extension strictly for Spatial Queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add AI Metadata Columns to the leads table (Gemini Integration)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS roi_score NUMERIC(3,1);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_value TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_analysis TEXT;

-- 3. Add Spatial Geometry column securely
ALTER TABLE leads ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(Point, 4326);

-- 4. Create Spatial Index for lightning-fast radius searches
CREATE INDEX IF NOT EXISTS idx_leads_geom ON leads USING GIST (geom);

-- 5. Create Index for ROI queries
CREATE INDEX IF NOT EXISTS idx_leads_roi ON leads(roi_score) WHERE roi_score IS NOT NULL;
