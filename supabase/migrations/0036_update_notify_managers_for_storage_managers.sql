-- Create a new function to handle notifications for storage managers
CREATE OR REPLACE FUNCTION public.notify_storage_managers_on_new_order()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
    item_warehouse_id UUID;
BEGIN
    -- Find the warehouse_id of the first item in the new order
    SELECT ei.warehouse_id INTO item_warehouse_id
    FROM public.order_items oi
    JOIN public.equipment_items ei ON oi.item_id = ei.id
    WHERE oi.order_id = NEW.id
    LIMIT 1;

    -- If a warehouse_id is found, notify managers of that warehouse
    IF item_warehouse_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, link)
        SELECT id, 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || (SELECT COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') FROM public.profiles WHERE id = NEW.user_id), '/orders'
        FROM public.profiles
        WHERE role = 'storage_manager' AND warehouse_id = item_warehouse_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Modify the existing trigger to also call the new function
-- First, drop the old trigger if it exists to recreate it with combined logic
DROP TRIGGER IF EXISTS on_order_created ON public.orders;

-- Create a new trigger that calls both notification functions
CREATE TRIGGER on_order_created
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_new_order();

CREATE TRIGGER on_order_created_for_storage_managers
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_storage_managers_on_new_order();