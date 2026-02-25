CREATE TABLE public.warehouse_time_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 for Sunday, 6 for Saturday
  slot_start_time TIME NOT NULL,
  slot_end_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT FALSE, -- Indicates if this specific slot is a "closed" slot (e.g., lunch break)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.warehouse_time_slots ENABLE ROW LEVEL SECURITY;

-- Policies for warehouse_time_slots
-- Managers and storage managers can view time slots for their assigned warehouse
CREATE POLICY "Managers and storage managers can view time slots" ON public.warehouse_time_slots
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE
      profiles.id = auth.uid() AND (
        profiles.role = 'manager' OR
        (profiles.role = 'storage_manager' AND profiles.warehouse_id = warehouse_time_slots.warehouse_id)
      )
  )
);

-- Managers and storage managers can insert/update/delete time slots for their assigned warehouse
CREATE POLICY "Managers and storage managers can manage time slots" ON public.warehouse_time_slots
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE
      profiles.id = auth.uid() AND (
        profiles.role = 'manager' OR
        (profiles.role = 'storage_manager' AND profiles.warehouse_id = warehouse_time_slots.warehouse_id)
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE
      profiles.id = auth.uid() AND (
        profiles.role = 'manager' OR
        (profiles.role = 'storage_manager' AND profiles.warehouse_id = warehouse_time_slots.warehouse_id)
      )
  )
);

-- Set up trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.warehouse_time_slots
FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');