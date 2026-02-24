-- Create 'מחסן א' if it doesn't exist
INSERT INTO public.warehouses (name)
VALUES ('מחסן א')
ON CONFLICT (name) DO NOTHING;

-- Create 'מחסן ב' if it doesn't exist
INSERT INTO public.warehouses (name)
VALUES ('מחסן ב')
ON CONFLICT (name) DO NOTHING;

-- Get the IDs of the newly created or existing warehouses
DO $$
DECLARE
    warehouse_a_id UUID;
    warehouse_b_id UUID;
BEGIN
    SELECT id INTO warehouse_a_id FROM public.warehouses WHERE name = 'מחסן א';
    SELECT id INTO warehouse_b_id FROM public.warehouses WHERE name = 'מחסן ב';

    -- Update the first 3 equipment items to 'מחסן א'
    UPDATE public.equipment_items
    SET warehouse_id = warehouse_a_id
    WHERE id IN (
        SELECT id FROM public.equipment_items
        ORDER BY created_at ASC
        LIMIT 3
    );

    -- Update the next 3 equipment items to 'מחסן ב'
    UPDATE public.equipment_items
    SET warehouse_id = warehouse_b_id
    WHERE id IN (
        SELECT id FROM public.equipment_items
        WHERE warehouse_id IS DISTINCT FROM warehouse_a_id -- Ensure we don't re-select items already assigned to A
        ORDER BY created_at ASC
        OFFSET 3
        LIMIT 3
    );
END $$;