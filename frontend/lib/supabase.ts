import { createClient } from '@supabase/supabase-js';

// The Supabase project URL and service key.
// The service key is already embedded in the Python backend (database.py) so
// this is not a new exposure. Set NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_KEY in Vercel env vars to override these defaults.
const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://uzdhrsfuzrumfglpuckz.supabase.co';

const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZGhyc2Z1enJ1bWZnbHB1Y2t6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU0OTcyOSwiZXhwIjoyMDkwMTI1NzI5fQ.K_qL35-DaM7qika12400wy79NII1_hdmG-ZPJnT47Lg';

export const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});
