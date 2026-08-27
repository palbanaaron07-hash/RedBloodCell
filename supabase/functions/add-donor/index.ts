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

function randomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
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
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const fallbackAdminEmails = String(Deno.env.get('ADMIN_EMAILS') || 'admin@bloodconnect.com,adminblood@gmail.com')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const {
    data: { user: fetchedUser },
    error: authError
  } = await userClient.auth.getUser();

  if (authError || !fetchedUser) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  const user = fetchedUser;

  const { data: callerAdmin, error: adminLookupError } = await adminClient
    .schema('blood_bank')
    .from('admin')
    .select('admin_id')
    .eq('email', user?.email || '')
    .maybeSingle();

  const isFallbackAdmin = fallbackAdminEmails.includes(String(user?.email || '').toLowerCase());

  if (adminLookupError && !isFallbackAdmin) {
    return jsonResponse({ error: 'Failed to validate caller admin account' }, 500);
  }

  if (!callerAdmin && !isFallbackAdmin) {
    return jsonResponse({ error: 'Forbidden. Admin access required.' }, 403);
  }

  const payload = await req.json().catch(() => ({}));

  const firstName = String(payload.first_name || '').trim();
  const middleName = String(payload.middle_name || '').trim() || null;
  const lastName = String(payload.last_name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const contactNumber = String(payload.contact_number || payload.phone || '').trim() || null;
  const bloodType = String(payload.blood_type || '').trim();
  const gender = String(payload.gender || '').trim() || null;
  const dateOfBirth = String(payload.date_of_birth || payload.dob || '').trim() || null;
  const address = String(payload.address || '').trim() || null;
  const availabilityStatus = String(payload.availability_status || '').trim() || 'available';
  const lastDonationDate = String(payload.last_donation_date || '').trim() || null;

  if (!firstName || !lastName || !email || !bloodType) {
    return jsonResponse({ error: 'First name, last name, email, and blood type are required.' }, 400);
  }

  const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (!validBloodTypes.includes(bloodType)) {
    return jsonResponse({ error: 'Invalid blood type.' }, 400);
  }

  const password = randomPassword(12);

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      role: 'donor',
      roles: ['donor']
    }
  });

  if (createError || !createdUser.user) {
    const message = createError?.message || 'Failed to create donor auth account';
    const status = message.toLowerCase().includes('already') ? 409 : 400;
    return jsonResponse({ error: message }, status);
  }

  const { data: donor, error: insertDonorError } = await adminClient
    .schema('blood_bank')
    .from('donor')
    .insert({
      auth_user_id: createdUser.user.id,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      email,
      contact_number: contactNumber,
      blood_type: bloodType,
      gender,
      date_of_birth: dateOfBirth,
      address,
      availability_status: availabilityStatus,
      last_donation_date: lastDonationDate
    })
    .select('donor_id, first_name, middle_name, last_name, email, contact_number, blood_type, gender, date_of_birth, address, availability_status, last_donation_date, created_at')
    .single();

  if (insertDonorError) {
    await adminClient.auth.admin.deleteUser(createdUser.user.id).catch(() => null);
    return jsonResponse({ error: 'Donor auth account created, but donor save failed: ' + insertDonorError.message }, 500);
  }

  return jsonResponse(
    {
      data: {
        donor
      }
    },
    201
  );
});
