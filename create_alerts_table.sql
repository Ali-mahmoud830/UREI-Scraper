CREATE TABLE saved_searches (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  city TEXT,
  min_price BIGINT,
  max_price BIGINT,
  property_type TEXT,
  target_audience TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: No RLS policies are strictly necessary right now if we access it purely through the service role key on the backend 
-- or we can open it up for anon reads if we want to allow the frontend to fetch directly via email.
-- Let's enable read access by users based on their session key if we have a table join, 
-- but since we'll proxy the "save" through Next.js for security or directly to Supabase anon with a simple policy.

-- Enable easy insert/select for anyone for the sake of the rapid MVP UI:
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to saved_searches" ON saved_searches FOR ALL USING (true) WITH CHECK (true);
