-- Create the function that calls the Edge Function
CREATE OR REPLACE FUNCTION public.call_notify_user_on_order_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    webhook_url TEXT;
    response_status INT;
    response_body TEXT;
BEGIN
    -- Only trigger if the status changed to 'approved'
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
        -- Construct the URL for the Edge Function
        webhook_url := 'https://nbndaiaipjpjjbmoryuc.supabase.co/functions/v1/notify_user_on_order_approved';

        -- Call the Edge Function
        SELECT INTO response_status, response_body
        net.http_post(
            webhook_url,
            '{}', -- Headers (empty for now, as auth is handled by service key in function)
            jsonb_build_object('record', NEW)
        );

        RAISE LOG 'Edge Function call for order approval notification. Status: %, Body: %', response_status, response_body;
    END IF;

    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_order_approved ON public.orders;
CREATE TRIGGER on_order_approved
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.call_notify_user_on_order_approved();