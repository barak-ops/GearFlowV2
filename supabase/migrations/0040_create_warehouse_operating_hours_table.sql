-- Create table for warehouse operating hours
CREATE TABLE public.warehouse_operating_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 for Sunday, 6 for Saturday
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (warehouse_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.warehouse_operating_hours ENABLE ROW LEVEL SECURITY;

-- Policies for warehouse_operating_hours
-- Managers and storage managers can view operating hours for their assigned warehouse
CREATE POLICY "Managers and storage managers can view operating hours" ON public.warehouse_operating_hours
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE
      profiles.id = auth.uid() AND (
        profiles.role = 'manager' OR
        (profiles.role = 'storage_manager' AND profiles.warehouse_id = warehouse_operating_hours.warehouse_id)
      )
  )
);

-- Managers and storage managers can insert/update operating hours for their assigned warehouse
CREATE POLICY "Managers and storage managers can manage operating hours" ON public.warehouse_operating_hours
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE
      profiles.id = auth.uid() AND (
        profiles.role = 'manager' OR
        (profiles.role = 'storage_manager' AND profiles.warehouse_id = warehouse_operating_hours.warehouse_id)
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE
      profiles.id = auth.uid() AND (
        profiles.role = 'manager' OR
        (profiles.role = 'storage_manager' AND profiles.warehouse_id = warehouse_operating_hours.warehouse_id)
      )
  )
);

-- Set up trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.warehouse_operating_hours
FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');