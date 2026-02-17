-- Drop table if it already exists to prevent "relation already exists" errors
DROP TABLE IF EXISTS public.user_consents CASCADE;

-- Create user_consents table
CREATE TABLE public.user_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consent_template_id UUID REFERENCES public.consent_templates(id) ON DELETE CASCADE NOT NULL,
  signature_image_url TEXT,
  full_name_signed TEXT,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, consent_template_id) -- Ensure a user can only consent to a specific template once
);

-- Enable RLS for user_consents
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Policies for user_consents
-- Users can view their own consents
CREATE POLICY "Users can view their own consents" ON public.user_consents
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can insert their own consents
CREATE POLICY "Users can insert their own consents" ON public.user_consents
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Prevent user updates to consents (consents should be immutable once given)
CREATE POLICY "Prevent user updates to consents" ON public.user_consents
FOR UPDATE TO authenticated USING (false);

-- Prevent user deletes of consents (consents should be immutable once given)
CREATE POLICY "Prevent user deletes of consents" ON public.user_consents
FOR DELETE TO authenticated USING (false);

-- Managers can view all user consents
CREATE POLICY "Managers can view all user consents" ON public.user_consents
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

-- Add audit triggers for user_consents
CREATE TRIGGER user_consents_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_consents
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Add consent_form_id to orders table if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.orders
    ADD COLUMN consent_form_id UUID REFERENCES public.consent_templates(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column consent_form_id already exists in public.orders.';
END $$;

-- Add a policy to allow managers to update consent_form_id on orders
-- This policy might already exist, so we'll try to create it. If it fails, it's fine.
DO $$ BEGIN
    CREATE POLICY "Managers can update consent_form_id on orders" ON public.orders
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));
EXCEPTION
    WHEN duplicate_object THEN RAISE NOTICE 'policy "Managers can update consent_form_id on orders" already exists.';
END $$;

-- Add policies for students to view/insert orders with consent_form_id
DO $$ BEGIN
    CREATE POLICY "Users can select orders with consent_form_id" ON public.orders
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN RAISE NOTICE 'policy "Users can select orders with consent_form_id" already exists.';
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert orders with consent_form_id" ON public.orders
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN RAISE NOTICE 'policy "Users can insert orders with consent_form_id" already exists.';
END $$;

-- Add is_receipt_form to consent_templates table if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.consent_templates
    ADD COLUMN is_receipt_form BOOLEAN DEFAULT FALSE;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column is_receipt_form already exists in public.consent_templates.';
END $$;

-- Add a policy to allow managers to update is_receipt_form on consent_templates
DO $$ BEGIN
    CREATE POLICY "Managers can update is_receipt_form on consent_templates" ON public.consent_templates
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));
EXCEPTION
    WHEN duplicate_object THEN RAISE NOTICE 'policy "Managers can update is_receipt_form on consent_templates" already exists.';
END $$;