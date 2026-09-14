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

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user?.email) return jsonResponse({ error: 'Unauthorized' }, 401);
  const fallbackAdminEmails = String(Deno.env.get('ADMIN_EMAILS') || 'admin@bloodconnect.com,adminblood@gmail.com')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const isFallbackAdmin = fallbackAdminEmails.includes(authData.user.email.toLowerCase());

  const { data: callerAdmin, error: adminError } = await adminClient
    .schema('blood_bank')
    .from('admin')
    .select('admin_id')
    .eq('email', authData.user.email)
    .maybeSingle();
  if (adminError && !isFallbackAdmin) return jsonResponse({ error: 'Failed to validate admin account' }, 500);
  if (!callerAdmin && !isFallbackAdmin) return jsonResponse({ error: 'Forbidden. Admin access required.' }, 403);

  const { data, error } = await adminClient
    .schema('blood_bank')
    .from('donor')
    .select('donor_id, auth_user_id, first_name, middle_name, last_name, email, contact_number, blood_type, gender, date_of_birth, address, availability_status, donor_status, last_donation_date, created_at, show_on_map, location_status, map_area')
    .order('created_at', { ascending: false });

  if (error) {
    return jsonResponse({ error: 'Failed to load donors: ' + error.message }, 500);
  }

  const donors = (data || [])
    .filter((row) => {
      const email = String(row.email || '').toLowerCase();
      const first = String(row.first_name || '').toLowerCase();
      const last = String(row.last_name || '').toLowerCase();
      const isTempEmail = email.startsWith('donor.test.') && email.endsWith('@example.com');
      const isTempName = first === 'temp' && last === 'donor';
      return !isTempEmail && !isTempName;
    })
    .map((row) => ({
    id: row.donor_id,
    auth_user_id: row.auth_user_id,
    first_name: row.first_name,
    middle_name: row.middle_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.contact_number,
    blood_type: row.blood_type,
    gender: row.gender,
    date_of_birth: row.date_of_birth,
    address: row.address,
    availability_status: row.availability_status,
    donor_status: row.donor_status || 'registered',
    show_on_map: row.show_on_map === true,
    location_status: row.location_status || 'needs_review',
    map_area: row.map_area || row.address || null,
    area: row.map_area || null,
    last_donation_date: row.last_donation_date,
    created_at: row.created_at,
    is_eligible: String(row.availability_status || '').toLowerCase() === 'available'
  }));

  return jsonResponse({ data: donors }, 200);
});
