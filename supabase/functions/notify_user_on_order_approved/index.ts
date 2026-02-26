import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[notify_user_on_order_approved] Request received", req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[notify_user_on_order_approved] Missing Supabase environment variables.");
      return new Response(JSON.stringify({ error: 'Missing Supabase environment variables.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const newOrder = payload.record; // The new or updated order record
    const oldOrder = payload.old_record; // The old order record

    console.log("[notify_user_on_order_approved] Payload received:", JSON.stringify(payload));

    if (newOrder && newOrder.status === 'approved' && oldOrder?.status !== 'approved') {
      console.log(`[notify_user_on_order_approved] Order ${newOrder.id} status changed to 'approved'. Notifying user ${newOrder.user_id}.`);

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', newOrder.user_id)
        .single();

      if (profileError) {
        console.error("[notify_user_on_order_approved] Error fetching user profile:", profileError);
        // Do not throw error here, just log it, as notification is secondary
        // return new Response(JSON.stringify({ error: 'Error fetching user profile for notification' }), {
        //   status: 500,
        //   headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        // });
      }

      const userName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'המשתמש';
      console.log(`[notify_user_on_order_approved] User name for notification: ${userName}`);

      const { error: insertError } = await adminClient
        .from('notifications')
        .insert({
          user_id: newOrder.user_id,
          title: 'הזמנתך אושרה!',
          message: `הזמנה מספר ${newOrder.id.substring(0, 8)}... אושרה על ידי המערכת.`,
          link: '/my-orders',
        });

      if (insertError) {
        console.error("[notify_user_on_order_approved] Error inserting notification:", insertError);
        // Do not throw error here, just log it, as notification is secondary
        // return new Response(JSON.stringify({ error: 'Error inserting notification' }), {
        //   status: 500,
        //   headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        // });
      } else {
        console.log(`[notify_user_on_order_approved] Notification sent for order ${newOrder.id}.`);
      }
    } else {
      console.log("[notify_user_on_order_approved] Order status not 'approved' or old status was already 'approved'. Skipping notification.");
    }

    return new Response(JSON.stringify({ message: 'Notification process completed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[notify_user_on_order_approved] Unexpected error in Edge Function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})