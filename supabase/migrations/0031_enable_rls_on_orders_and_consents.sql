-- Enable RLS on orders table (if not already enabled)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow managers to update the consent_form_id
-- This policy is for the specific case of updating the consent_form_id column.
CREATE POLICY "Managers can update consent_form_id on orders" ON public.orders
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

-- Create a policy to allow users to select their own orders
CREATE POLICY "Users can select their own orders" ON public.orders
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Create a policy to allow users to insert their own orders
CREATE POLICY "Users can insert their own orders" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create a policy to allow managers to view all orders
CREATE POLICY "Managers can view all orders" ON public.orders
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

-- Create a policy to allow managers to update any order
CREATE POLICY "Managers can update all orders" ON public.orders
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

-- Enable RLS on user_consents table (if not already enabled)
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow users to view their own consents
CREATE POLICY "Users can view their own consents" ON public.user_consents
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Create a policy to allow users to insert their own consents
CREATE POLICY "Users can insert their own consents" ON public.user_consents
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create a policy to prevent users from updating their consents (consents are immutable once given)
CREATE POLICY "Prevent user updates to consents" ON public.user_consents
FOR UPDATE TO authenticated
USING (false);

-- Create a policy to prevent users from deleting their consents
CREATE POLICY "Prevent user deletes of consents" ON public.user_consents
FOR DELETE TO authenticated
USING (false);

-- Create a policy to allow managers to view all user consents
CREATE POLICY "Managers can view all user consents" ON public.user_consents
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));