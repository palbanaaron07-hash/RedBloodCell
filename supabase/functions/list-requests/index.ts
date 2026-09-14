// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase environment configuration' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

  // Verify that caller is an authenticated admin
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user?.email) return jsonResponse({ error: 'Unauthorized' }, 401);

  const fallbackAdminEmails = String(Deno.env.get('ADMIN_EMAILS') || 'admin@bloodconnect.com,adminblood@gmail.com')
    .split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  const isFallbackAdmin = fallbackAdminEmails.includes(authData.user.email.toLowerCase());

  const { data: callerAdmin, error: adminError } = await adminClient
    .schema('blood_bank')
    .from('admin')
    .select('admin_id')
    .eq('email', authData.user.email)
    .maybeSingle();

  if (adminError && !isFallbackAdmin) return jsonResponse({ error: 'Failed to validate admin account' }, 500);
  if (!callerAdmin && !isFallbackAdmin) return jsonResponse({ error: 'Forbidden. Admin access required.' }, 403);

  // Parse optional limit from query string
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || '100'), 500);

  // Fetch blood_request rows with patient join using service role (bypasses RLS)
  const { data, error } = await adminClient
    .schema('blood_bank')
    .from('blood_request')
    .select('request_id, inventory_id, blood_type_needed, quantity, urgency_level, status, community_status, expires_at, community_fulfilled_at, request_date, note, admin_note, patient_id, request_type, verification_status, hospital_reference, recipient_received_at, patient(auth_user_id, first_name, middle_name, last_name, email, hospital_name, contact_number, address), replacement_campaign(target_units, pledged_units, confirmed_units, status, confirmation_reference)')
    .order('request_date', { ascending: false })
    .limit(limit);

  if (error) {
    return jsonResponse({ error: 'Failed to load requests: ' + error.message }, 500);
  }

  return jsonResponse({ data: data || [] }, 200);
});
