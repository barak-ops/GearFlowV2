import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[get-users] Request received", req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[get-users] Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is a manager or storage_manager
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("[get-users] Auth error", userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, warehouse_id')
      .eq('id', user.id)
      .single();

    if (profileError || (profile?.role !== 'manager' && profile?.role !== 'storage_manager')) {
      console.error("[get-users] Forbidden access", profile?.role);
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use service role to fetch all users from auth.users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    let profilesQuery = adminClient
      .from('profiles')
      .select('*, warehouses(name)');
    
    // If the current user is a storage manager, filter profiles by their warehouse_id
    if (profile.role === 'storage_manager' && profile.warehouse_id) {
      profilesQuery = profilesQuery.eq('warehouse_id', profile.warehouse_id);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;
    
    if (profilesError) throw profilesError;

    // Fetch auth users to merge email
    const { data: { users: authUsers }, error: authUsersError } = await adminClient.auth.admin.listUsers();
    if (authUsersError) throw authUsersError;

    // Merge auth data (email) with profile data
    const mergedUsers = profiles.map(p => {
      const authUser = authUsers.find(u => u.id === p.id);
      return {
        ...p,
        email: authUser?.email || 'N/A'
      };
    });

    return new Response(JSON.stringify(mergedUsers), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[get-users] Unexpected error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      ,status: 400,
    });
  }
})