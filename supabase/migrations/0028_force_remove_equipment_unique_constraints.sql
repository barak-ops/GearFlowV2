-- This migration forcefully removes unique constraints that may be causing issues.
-- We are dropping constraints on barcode, sku, and serial_number from the equipment_items table.

-- Drop barcode constraint
ALTER TABLE public.equipment_items DROP CONSTRAINT IF EXISTS equipment_items_barcode_key;

-- Drop SKU constraint
ALTER TABLE public.equipment_items DROP CONSTRAINT IF EXISTS equipment_items_sku_key;

-- Drop serial number constraint
ALTER TABLE public.equipment_items DROP CONSTRAINT IF EXISTS equipment_items_serial_number_key;

-- Notify PostgREST to reload the schema to apply changes to the API.
NOTIFY pgrst, 'reload schema';