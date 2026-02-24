-- Update the notify_managers_on_new_order function to correctly include the storage manager of the ordering user's warehouse
CREATE OR REPLACE FUNCTION public.notify_managers_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  student_warehouse_id UUID;
  student_name TEXT;
BEGIN
  -- Get the student's warehouse_id and name
  SELECT warehouse_id, COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
  INTO student_warehouse_id, student_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Insert notifications for all general managers and the specific storage manager (if applicable)
  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT DISTINCT p.id, 'בקשת השאלה חדשה', 'התקבלה בקשת השאלה חדשה מ-' || student_name, '/orders'
  FROM public.profiles p
  WHERE p.role = 'manager' -- All general managers
     OR (p.role = 'storage_manager' AND p.warehouse_id = student_warehouse_id); -- Specific storage manager

  RETURN NEW;
END;
$function$;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_order_created ON public.orders;
CREATE TRIGGER on_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_new_order();