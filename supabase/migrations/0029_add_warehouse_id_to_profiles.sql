-- Add warehouse_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- Notify PostgREST to reload the schema cache to recognize the new column immediately
NOTIFY pgrst, 'reload schema';