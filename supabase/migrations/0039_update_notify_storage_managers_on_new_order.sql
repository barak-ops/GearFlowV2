CREATE OR REPLACE FUNCTION public.notify_storage_managers_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    item_warehouse_id UUID;
BEGIN
    -- Use the warehouse_id directly from the new order record
    item_warehouse_id := NEW.warehouse_id;

    -- If a warehouse_id is found, notify managers of that warehouse
    IF item_warehouse_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, link)
        SELECT id, 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || (SELECT COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') FROM public.profiles WHERE id = NEW.user_id), '/orders'
        FROM public.profiles
        WHERE role = 'storage_manager' AND warehouse_id = item_warehouse_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- Ensure the trigger is correctly set up to call this function
DROP TRIGGER IF EXISTS on_order_created_for_storage_managers ON public.orders;
CREATE TRIGGER on_order_created_for_storage_managers
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_storage_managers_on_new_order();