-- Update the notify_managers_on_new_order function to correctly include the storage manager of the ordering user's warehouse
CREATE OR REPLACE FUNCTION public.notify_managers_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  manager_ids UUID[];
  student_warehouse_id UUID;
  student_name TEXT;
  relevant_storage_manager_id UUID;
BEGIN
  -- Get the student's warehouse_id and name
  SELECT warehouse_id, COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
  INTO student_warehouse_id, student_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Initialize manager_ids with all general managers
  SELECT ARRAY_AGG(id)
  INTO manager_ids
  FROM public.profiles
  WHERE role = 'manager';

  -- If the student has a warehouse, find the storage manager for that warehouse
  IF student_warehouse_id IS NOT NULL THEN
    SELECT id
    INTO relevant_storage_manager_id
    FROM public.profiles
    WHERE role = 'storage_manager' AND warehouse_id = student_warehouse_id
    LIMIT 1; -- Assuming one storage manager per warehouse

    -- If a relevant storage manager is found, add them to the list of manager_ids
    IF relevant_storage_manager_id IS NOT NULL THEN
      manager_ids := ARRAY_APPEND(manager_ids, relevant_storage_manager_id);
    END IF;
  END IF;

  -- Insert notifications for all collected manager IDs (distinct to avoid duplicates)
  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT DISTINCT unnest(manager_ids), 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || student_name, '/orders';

  RETURN NEW;
END;
$function$;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_order_created ON public.orders;
CREATE TRIGGER on_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_new_order();