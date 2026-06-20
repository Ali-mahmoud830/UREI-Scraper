-- ==============================================================================
-- PHASE 3: MULTI-FLOOR & PENTHOUSE SCHEMA UPDATE
-- ==============================================================================

-- 1. Create a dedicated 'properties' table for manual uploads (if not already existing)
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    price TEXT,
    location TEXT,
    property_type TEXT,
    listing_type TEXT, -- 'sale' or 'rent'
    floor_breakdown JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add the floor_breakdown JSONB column to the existing 'leads' table
-- This allows scraped leads to also store complex floor data if parsed by AI
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS floor_breakdown JSONB DEFAULT '[]'::jsonb;

-- Example JSON structure for floor_breakdown:
-- [
--   { "level": "Floor 1", "sqm": 70, "rooms": "2 Bed, 1 Bath", "features": "Open Kitchen" },
--   { "level": "Floor 2", "sqm": 45, "rooms": "Master Bed, Walk-in Closet", "features": "Balcony" },
--   { "level": "Roof", "sqm": 20, "rooms": "Pergola", "features": "BBQ Area, Jacuzzi" }
-- ]
