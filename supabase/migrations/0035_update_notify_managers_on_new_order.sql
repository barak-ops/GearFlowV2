-- Update the notify_managers_on_new_order function to explicitly collect manager IDs and storage manager IDs before inserting notifications.
CREATE OR REPLACE FUNCTION public.notify_managers_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  all_recipient_ids UUID[];
  general_manager_ids UUID[];
  student_warehouse_id UUID;
  student_name TEXT;
  specific_storage_manager_id UUID;
BEGIN
  -- Get the student's warehouse_id and name
  SELECT warehouse_id, COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
  INTO student_warehouse_id, student_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Collect IDs of all general managers
  SELECT ARRAY_AGG(id)
  INTO general_manager_ids
  FROM public.profiles
  WHERE role = 'manager';

  -- Initialize all_recipient_ids with general managers (can be empty if no general managers)
  all_recipient_ids := COALESCE(general_manager_ids, ARRAY[]::UUID[]);

  -- If the student has a warehouse, find the storage manager for that warehouse
  IF student_warehouse_id IS NOT NULL THEN
    SELECT id
    INTO specific_storage_manager_id
    FROM public.profiles
    WHERE role = 'storage_manager' AND warehouse_id = student_warehouse_id
    LIMIT 1; -- Assuming one storage manager per warehouse

    -- If a specific storage manager is found, add them to the recipient list
    IF specific_storage_manager_id IS NOT NULL THEN
      all_recipient_ids := ARRAY_APPEND(all_recipient_ids, specific_storage_manager_id);
    END IF;
  END IF;

  -- Insert notifications for all collected recipient IDs (distinct to avoid duplicates)
  -- Only insert if there are recipients
  IF ARRAY_LENGTH(all_recipient_ids, 1) > 0 THEN
    INSERT INTO public.notifications (user_id, title, message, link)
    SELECT DISTINCT unnest(all_recipient_ids), 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || student_name, '/orders';
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_order_created ON public.orders;
CREATE TRIGGER on_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_new_order();