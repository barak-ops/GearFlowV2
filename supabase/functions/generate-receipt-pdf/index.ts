import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[generate-receipt-pdf] Request received", req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[generate-receipt-pdf] Missing Authorization header");
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
      console.error("[generate-receipt-pdf] Auth error", userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { orderId, userName, items, startDate, endDate } = await req.json();

    // In a real-world scenario, you would generate a PDF dynamically here.
    // For this example, we'll return a placeholder URL.
    // You might use a service like DocRaptor, PdfMonkey, or a Deno-compatible PDF library.
    const placeholderPdfUrl = "https://www.africau.edu/images/default/sample.pdf"; // Example placeholder PDF

    // Store the PDF URL in the orders table
    const { error: updateOrderError } = await supabaseClient
      .from('orders')
      .update({ receipt_pdf_url: placeholderPdfUrl })
      .eq('id', orderId);

    if (updateOrderError) throw updateOrderError;

    return new Response(JSON.stringify({ pdfUrl: placeholderPdfUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[generate-receipt-pdf] Unexpected error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})