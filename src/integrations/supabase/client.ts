import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ibmRhaWFpcGpwampibW9yeXVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTIxMTcsImV4cCI6MjA4NTc2ODExN30.wfTiEWRsP65zx5G-SrjK4hmqyeRCKPVyBW-nvdUOtbw";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);