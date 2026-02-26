-- Add faculty column to profiles table
ALTER TABLE public.profiles
ADD COLUMN faculty text NULL;

-- Optional: Add RLS policy for faculty if needed, e.g., for managers to view
-- For now, assuming service role key handles access in get-users function.