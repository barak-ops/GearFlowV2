ALTER TABLE public.consent_templates
ADD COLUMN is_receipt_form BOOLEAN DEFAULT FALSE;

-- Optional: Add a policy to allow managers to update this new column
CREATE POLICY "Managers can update is_receipt_form on consent_templates" ON public.consent_templates
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));