CREATE OR REPLACE FUNCTION public.notify_managers_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  general_manager_ids UUID[];
  specific_storage_manager_id UUID;
  all_recipient_ids UUID[];
  item_warehouse_id UUID;
BEGIN
  -- Get IDs of all general managers
  SELECT ARRAY_AGG(id)
  FROM public.profiles
  WHERE role = 'manager'
  INTO general_manager_ids;

  -- Get the warehouse_id of the first item in the order (assuming all items in an order are from the same warehouse)
  SELECT ei.warehouse_id
  INTO item_warehouse_id
  FROM public.order_items oi
  JOIN public.equipment_items ei ON oi.item_id = ei.id
  WHERE oi.order_id = NEW.id
  LIMIT 1;

  -- Get the ID of the storage manager for that specific warehouse
  IF item_warehouse_id IS NOT NULL THEN
    SELECT id
    FROM public.profiles
    WHERE role = 'storage_manager' AND warehouse_id = item_warehouse_id
    INTO specific_storage_manager_id;
  END IF;

  -- Combine all recipient IDs
  all_recipient_ids := general_manager_ids;
  IF specific_storage_manager_id IS NOT NULL AND NOT (specific_storage_manager_id = ANY(all_recipient_ids)) THEN
    all_recipient_ids := array_append(all_recipient_ids, specific_storage_manager_id);
  END IF;

  -- Insert notifications for all identified recipients
  IF ARRAY_LENGTH(all_recipient_ids, 1) > 0 THEN
    INSERT INTO public.notifications (user_id, title, message, link)
    SELECT id, 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || (SELECT COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') FROM public.profiles WHERE id = NEW.user_id), '/orders'
    FROM public.profiles
    WHERE id = ANY(all_recipient_ids);
  END IF;

  RETURN NEW;
END;
$function$;