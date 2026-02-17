-- Add consent_form_id to equipment_items table
ALTER TABLE public.equipment_items
ADD COLUMN consent_form_id UUID REFERENCES public.consent_templates(id) ON DELETE SET NULL;

-- Add a policy to allow managers to update consent_form_id on equipment_items
CREATE POLICY "Equipment write access for managers" ON public.equipment_items
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));