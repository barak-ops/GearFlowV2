-- Add consent_form_id to orders table
ALTER TABLE public.orders
ADD COLUMN consent_form_id UUID REFERENCES public.user_consents(id) ON DELETE SET NULL;

-- Enable RLS on orders table (if not already enabled)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow managers to update the consent_form_id
CREATE POLICY "Managers can update consent_form_id on orders" ON public.orders
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

-- Create a policy to allow users to select orders with consent_form_id
CREATE POLICY "Users can select orders with consent_form_id" ON public.orders
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Create a policy to allow users to insert orders with consent_form_id
CREATE POLICY "Users can insert orders with consent_form_id" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Trigger for audit logs (if not already present for this column)
-- This assumes an audit_trigger function already exists.
-- If not, you would need to create it.
-- DROP TRIGGER IF EXISTS orders_audit_trigger ON public.orders;
-- CREATE TRIGGER orders_audit_trigger
-- AFTER INSERT OR UPDATE OR DELETE ON public.orders
-- FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();