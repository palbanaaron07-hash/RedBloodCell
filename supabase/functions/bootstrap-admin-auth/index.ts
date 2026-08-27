// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

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

function normalizeBcryptHash(hash: string) {
  // PHP password_hash commonly uses $2y$, while bcryptjs expects $2a$/$2b$.
  return String(hash || '').replace(/^\$2y\$/, '$2a$');
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  const target = String(email || '').toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      return { user: null, error };
    }

    const users = data?.users || [];
    if (users.length === 0) break;

    const user = users.find((entry) => String(entry.email || '').toLowerCase() === target);
    if (user) return { user, error: null };
  }

  return { user: null, error: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase environment configuration' }, 500);
  }

  const payload = await req.json().catch(() => ({}));
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');

  if (!email || !password) {
    return jsonResponse({ error: 'Email and password are required.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: adminRow, error: adminLookupError } = await adminClient
    .schema('blood_bank')
    .from('admin')
    .select('admin_id, email, password_hash, first_name, last_name')
    .eq('email', email)
    .maybeSingle();

  if (adminLookupError) {
    return jsonResponse({ error: 'Failed to validate admin account.' }, 500);
  }

  if (!adminRow?.password_hash) {
    return jsonResponse({ error: 'Invalid login credentials.' }, 401);
  }

  const hash = normalizeBcryptHash(adminRow.password_hash);
  const validPassword = bcrypt.compareSync(password, hash);

  if (!validPassword) {
    return jsonResponse({ error: 'Invalid login credentials.' }, 401);
  }

  const { user: authUser, error: authLookupError } = await findAuthUserByEmail(adminClient, email);
  if (authLookupError) {
    return jsonResponse({ error: 'Failed to inspect auth account.' }, 500);
  }

  if (!authUser) {
    const { error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        first_name: adminRow.first_name,
        last_name: adminRow.last_name
      }
    });

    if (createError) {
      return jsonResponse({ error: createError.message || 'Failed to create admin auth account.' }, 500);
    }

    return jsonResponse({ data: { bootstrapped: true } }, 200);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...(authUser.user_metadata || {}),
      role: 'admin',
      first_name: adminRow.first_name,
      last_name: adminRow.last_name
    }
  });

  if (updateError) {
    return jsonResponse({ error: updateError.message || 'Failed to sync admin auth password.' }, 500);
  }

  return jsonResponse({ data: { bootstrapped: true } }, 200);
});
