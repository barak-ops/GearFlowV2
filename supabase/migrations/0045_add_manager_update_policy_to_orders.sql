-- Use ALTER POLICY to modify the existing policy, or create it if it doesn't exist (though ALTER assumes existence).
-- If the policy truly doesn't exist, this will fail, but it's safer than DROP/CREATE if a ghost policy exists.

-- First, ensure the policy exists. If it doesn't, the ALTER will fail, and we'll need to create it.
-- For now, let's assume it exists and try to alter it.
-- If this still fails, we might need to manually drop it via the Supabase UI or a direct SQL command.

ALTER POLICY "Managers can update all orders" ON public.orders
FOR UPDATE TO authenticated
USING (EXISTS ( SELECT 1 FROM public.profiles WHERE (profiles.id = auth.uid()) AND (profiles.role = 'manager'::text)));

-- If the above ALTER fails because the policy doesn't exist, you would typically
-- add a CREATE POLICY here, but that would reintroduce the "already exists" problem.
-- The ideal solution is to ensure the policy is created once and then altered.
-- Given the persistent error, ALTER is the next logical step assuming a "ghost" policy.