CREATE OR REPLACE FUNCTION public.notify_storage_managers_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    order_warehouse_id UUID;
    order_user_id UUID;
    order_user_name TEXT;
    manager_profile RECORD;
BEGIN
    order_warehouse_id := NEW.warehouse_id;
    order_user_id := NEW.user_id;

    -- Get the name of the user who created the order
    SELECT COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
    INTO order_user_name
    FROM public.profiles
    WHERE id = order_user_id;

    RAISE NOTICE '[notify_storage_managers_on_new_order] New order created: order_id=%, user_id=%, warehouse_id=%', NEW.id, order_user_id, order_warehouse_id;

    IF order_warehouse_id IS NOT NULL THEN
        RAISE NOTICE '[notify_storage_managers_on_new_order] Searching for storage managers for warehouse_id=%', order_warehouse_id;

        FOR manager_profile IN
            SELECT id, first_name, last_name
            FROM public.profiles
            WHERE role = 'storage_manager' AND warehouse_id = order_warehouse_id
        LOOP
            RAISE NOTICE '[notify_storage_managers_on_new_order] Found storage manager: id=%, name=%', manager_profile.id, manager_profile.first_name;
            INSERT INTO public.notifications (user_id, title, message, link)
            VALUES (manager_profile.id, 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || order_user_name || ' עבור המחסן שלך.', '/orders');
        END LOOP;
    ELSE
        RAISE NOTICE '[notify_storage_managers_on_new_order] Order has no warehouse_id, skipping storage manager notification.';
    END IF;

    RETURN NEW;
END;
$function$;

-- Ensure the trigger is correctly set up to call this function
DROP TRIGGER IF EXISTS on_order_created_for_storage_managers ON public.orders;
CREATE TRIGGER on_order_created_for_storage_managers
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_storage_managers_on_new_order();