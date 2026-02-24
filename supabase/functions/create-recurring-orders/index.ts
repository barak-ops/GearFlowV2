import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[create-recurring-orders] Request received", req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[create-recurring-orders] Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("[create-recurring-orders] Auth error", userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch the user's profile to get their warehouse_id
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('warehouse_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error("[create-recurring-orders] Error fetching user profile:", profileError);
      return new Response(JSON.stringify({ error: 'Error fetching user profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userWarehouseId = profile?.warehouse_id;

    const { startDate, endDate, notes, cartItems, isRecurring, recurrenceCount, recurrenceInterval } = await req.json();

    const ordersToInsert = [];
    let currentStartDate = new Date(startDate);
    let currentEndDate = new Date(endDate);

    for (let i = 0; i < recurrenceCount; i++) {
      ordersToInsert.push({
        user_id: user.id,
        warehouse_id: userWarehouseId, // Add the user's warehouse_id to the order
        requested_start_date: currentStartDate.toISOString(),
        requested_end_date: currentEndDate.toISOString(),
        notes: notes,
        is_recurring: isRecurring,
        recurrence_count: recurrenceCount,
        recurrence_interval: recurrenceInterval,
      });

      if (isRecurring && i < recurrenceCount - 1) {
        if (recurrenceInterval === 'day') {
          currentStartDate.setDate(currentStartDate.getDate() + 1);
          currentEndDate.setDate(currentEndDate.getDate() + 1);
        } else if (recurrenceInterval === 'week') {
          currentStartDate.setDate(currentStartDate.getDate() + 7);
          currentEndDate.setDate(currentEndDate.getDate() + 7);
        } else if (recurrenceInterval === 'month') {
          currentStartDate.setMonth(currentStartDate.getMonth() + 1);
          currentEndDate.setMonth(currentEndDate.getMonth() + 1);
        }
      }
    }

    const { data: insertedOrders, error: ordersError } = await supabaseClient
      .from('orders')
      .insert(ordersToInsert)
      .select('id');

    if (ordersError) throw ordersError;

    const orderItemsToInsert = [];
    for (const order of insertedOrders) {
      for (const item of cartItems) {
        orderItemsToInsert.push({
          order_id: order.id,
          item_id: item.id,
        });
      }
    }

    const { error: orderItemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsToInsert);

    if (orderItemsError) throw orderItemsError;

    return new Response(JSON.stringify({ message: 'Orders created successfully', orderIds: insertedOrders.map(o => o.id) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[create-recurring-orders] Unexpected error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})