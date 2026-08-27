// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

  if (req.method !== 'POST') {
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

  const payload = await req.json().catch(() => ({}));

  const donorId = Number(payload.donor_id);
  const isEligible = Boolean(payload.is_eligible);

  if (!Number.isInteger(donorId) || donorId <= 0) {
    return jsonResponse({ error: 'donor_id is required and must be a positive integer.' }, 400);
  }

  const availabilityStatus = isEligible ? 'available' : 'unavailable';

  const { data, error } = await adminClient
    .schema('blood_bank')
    .from('donor')
    .update({ availability_status: availabilityStatus })
    .eq('donor_id', donorId)
    .select('donor_id, first_name, middle_name, last_name, email, contact_number, blood_type, gender, date_of_birth, address, availability_status, last_donation_date, created_at')
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: 'Failed to update donor eligibility: ' + error.message }, 500);
  }

  if (!data) {
    return jsonResponse({ error: 'Donor not found.' }, 404);
  }

  return jsonResponse(
    {
      data: {
        id: data.donor_id,
        first_name: data.first_name,
        middle_name: data.middle_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.contact_number,
        blood_type: data.blood_type,
        gender: data.gender,
        date_of_birth: data.date_of_birth,
        address: data.address,
        availability_status: data.availability_status,
        last_donation_date: data.last_donation_date,
        created_at: data.created_at,
        is_eligible: String(data.availability_status || '').toLowerCase() === 'available'
      }
    },
    200
  );
});
