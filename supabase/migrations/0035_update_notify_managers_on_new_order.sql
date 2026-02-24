-- Update the notify_managers_on_new_order function to include the storage manager of the ordering user's warehouse
CREATE OR REPLACE FUNCTION public.notify_managers_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  manager_ids UUID[];
  student_warehouse_id UUID;
  student_name TEXT;
BEGIN
  -- Get the student's warehouse_id and name
  SELECT warehouse_id, COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
  INTO student_warehouse_id, student_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Collect IDs of all general managers
  SELECT ARRAY_AGG(id)
  INTO manager_ids
  FROM public.profiles
  WHERE role = 'manager';

  -- If the student has a warehouse and there's a storage manager for that warehouse, add their ID
  IF student_warehouse_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id)
    INTO manager_ids
    FROM public.profiles
    WHERE role = 'storage_manager' AND warehouse_id = student_warehouse_id
    UNION
    SELECT ARRAY_AGG(id)
    FROM public.profiles
    WHERE role = 'manager'; -- Include general managers as well
  END IF;

  -- Insert notifications for all collected manager IDs
  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT DISTINCT id, 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || student_name, '/orders'
  FROM public.profiles
  WHERE id = ANY(manager_ids);

  RETURN NEW;
END;
$function$;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_order_created ON public.orders;
CREATE TRIGGER on_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_new_order();