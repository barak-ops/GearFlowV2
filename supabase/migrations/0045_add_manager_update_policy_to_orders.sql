-- Drop existing policy if it exists to ensure idempotency
DROP POLICY IF EXISTS "Managers can update all orders" ON public.orders;

-- Add RLS policy for managers to update orders
CREATE POLICY "Managers can update all orders" ON public.orders
FOR UPDATE
TO authenticated
USING (EXISTS ( SELECT 1 FROM public.profiles WHERE (profiles.id = auth.uid()) AND (profiles.role = 'manager'::text)))
WITH CHECK (EXISTS ( SELECT 1 FROM public.profiles WHERE (profiles.id = auth.uid()) AND (profiles.role = 'manager'::text)));