import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://nbndaiaipjpjjbmoryuc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_G0yohnzWCcL0nR7RMe48iA_Dok8jVM4";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);