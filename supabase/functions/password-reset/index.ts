// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const OTP_TTL_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_EMAIL_REQUESTS_PER_HOUR = 5;
const MAX_IP_REQUESTS_PER_HOUR = 20;
const GENERIC_REQUEST_MESSAGE = 'If an account exists for that email, a verification code has been sent.';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function isStrongPassword(password: string) {
  return password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function clientIp(req: Request) {
  return String(
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown'
  ).trim();
}

async function audit(adminClient, values) {
  await adminClient.from('password_reset_events').insert(values);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hashSecret = Deno.env.get('PASSWORD_RESET_HASH_SECRET');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !hashSecret) {
    return jsonResponse({ error: 'Password reset service is not configured.' }, 503);
  }

  const payload = await req.json().catch(() => ({}));
  const action = String(payload.action || '');
  const email = normalizeEmail(payload.email);
  const ipHash = await sha256(`${hashSecret}:ip:${clientIp(req)}`);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  if (action === 'request') {
    if (!isEmail(email)) return jsonResponse({ error: 'Enter a valid email address.' }, 400);

    const emailHash = await sha256(`${hashSecret}:email:${email}`);
    const now = Date.now();
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const { data: current } = await adminClient
      .from('password_reset_challenges')
      .select('requested_at')
      .eq('email_hash', emailHash)
      .maybeSingle();

    const secondsSinceRequest = current?.requested_at
      ? Math.floor((now - new Date(current.requested_at).getTime()) / 1000)
      : RESEND_COOLDOWN_SECONDS;

    const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
      adminClient.from('password_reset_events').select('event_id', { count: 'exact', head: true })
        .eq('email_hash', emailHash).gte('created_at', hourAgo)
        .in('event_type', ['requested', 'request_limited']),
      adminClient.from('password_reset_events').select('event_id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash).gte('created_at', hourAgo)
        .in('event_type', ['requested', 'request_limited'])
    ]);

    const limited = secondsSinceRequest < RESEND_COOLDOWN_SECONDS ||
      Number(emailCount || 0) >= MAX_EMAIL_REQUESTS_PER_HOUR ||
      Number(ipCount || 0) >= MAX_IP_REQUESTS_PER_HOUR;

    if (limited) {
      await audit(adminClient, { email_hash: emailHash, ip_hash: ipHash, event_type: 'request_limited' });
      return jsonResponse({ message: GENERIC_REQUEST_MESSAGE, cooldown_seconds: RESEND_COOLDOWN_SECONDS });
    }

    const expiresAt = new Date(now + OTP_TTL_SECONDS * 1000).toISOString();
    await adminClient.from('password_reset_challenges').upsert({
      email_hash: emailHash,
      ip_hash: ipHash,
      requested_at: new Date(now).toISOString(),
      expires_at: expiresAt,
      verify_attempts: 0,
      verified_at: null,
      password_updated_at: null,
      consumed_at: null,
      user_id: null
    });

    // Supabase owns generation, hashing, delivery, expiry, and one-time use of the OTP.
    await anonClient.auth.resetPasswordForEmail(email);
    await audit(adminClient, { email_hash: emailHash, ip_hash: ipHash, event_type: 'requested' });

    return jsonResponse({ message: GENERIC_REQUEST_MESSAGE, cooldown_seconds: RESEND_COOLDOWN_SECONDS });
  }

  if (action === 'verify') {
    const token = String(payload.token || '').replace(/\D/g, '');
    if (!isEmail(email) || !/^\d{6}$/.test(token)) {
      return jsonResponse({ error: 'The code is invalid or expired.' }, 400);
    }

    const emailHash = await sha256(`${hashSecret}:email:${email}`);
    const { data: attemptRows, error: attemptError } = await adminClient
      .rpc('claim_password_reset_attempt', { target_email_hash: emailHash });
    const attempt = Array.isArray(attemptRows) ? attemptRows[0] : null;
    if (attemptError || !attempt?.allowed) {
      return jsonResponse({ error: 'The code is invalid or expired.' }, 400);
    }
    const nextAttempts = Number(attempt.attempts);

    const { data, error } = await anonClient.auth.verifyOtp({ email, token, type: 'recovery' });
    if (error || !data?.session || !data?.user) {
      await audit(adminClient, {
        email_hash: emailHash,
        ip_hash: ipHash,
        event_type: 'verification_failed',
        metadata: { attempt: nextAttempts }
      });
      return jsonResponse({
        error: nextAttempts >= MAX_VERIFY_ATTEMPTS
          ? 'Too many incorrect attempts. Request a new code.'
          : 'The code is invalid or expired.',
        attempts_remaining: Math.max(0, MAX_VERIFY_ATTEMPTS - nextAttempts)
      }, 400);
    }

    await adminClient.from('password_reset_challenges').update({
      verified_at: new Date().toISOString(),
      user_id: data.user.id
    }).eq('email_hash', emailHash);
    await audit(adminClient, {
      user_id: data.user.id,
      email_hash: emailHash,
      ip_hash: ipHash,
      event_type: 'verified'
    });

    return jsonResponse({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
  }

  if (action === 'reset') {
    const authHeader = req.headers.get('Authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    const password = String(payload.password || '');
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    const user = userData?.user;

    if (userError || !user?.email) return jsonResponse({ error: 'Verification has expired. Request a new code.' }, 401);
    if (!isStrongPassword(password)) {
      return jsonResponse({ error: 'Password does not meet the required security rules.' }, 400);
    }

    const verifiedEmail = normalizeEmail(user.email);
    const emailHash = await sha256(`${hashSecret}:email:${verifiedEmail}`);
    const { data: challenge } = await adminClient.from('password_reset_challenges')
      .select('*').eq('email_hash', emailHash).eq('user_id', user.id).maybeSingle();

    if (!challenge?.verified_at || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now()) {
      return jsonResponse({ error: 'Verification has expired. Request a new code.' }, 401);
    }

    // A compatibility sync may be retried after the Supabase password was already updated.
    if (challenge.password_updated_at) {
      return jsonResponse({ message: 'Password update is awaiting account synchronization.' });
    }

    const { data: adminRow } = await adminClient.schema('blood_bank').from('admin')
      .select('admin_id, password_hash').eq('email', verifiedEmail).maybeSingle();
    if (adminRow?.password_hash) {
      const oldHash = String(adminRow.password_hash).replace(/^\$2y\$/, '$2a$');
      if (bcrypt.compareSync(password, oldHash)) {
        return jsonResponse({ error: 'Your new password must be different from your current password.' }, 400);
      }
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, { password });
    if (updateError) return jsonResponse({ error: 'Unable to reset the password. Please try again.' }, 500);

    if (adminRow?.admin_id) {
      const passwordHash = bcrypt.hashSync(password, 12).replace(/^\$2a\$/, '$2b$');
      await adminClient.schema('blood_bank').from('admin')
        .update({ password_hash: passwordHash }).eq('admin_id', adminRow.admin_id);
    }

    await adminClient.from('password_reset_challenges')
      .update({ password_updated_at: new Date().toISOString() }).eq('email_hash', emailHash);

    return jsonResponse({ message: 'Your password has been reset successfully.' });
  }

  if (action === 'revoke') {
    const authHeader = req.headers.get('Authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'Unable to invalidate active sessions.' }, 401);
    }

    const verifiedEmail = normalizeEmail(userData.user.email);
    const emailHash = await sha256(`${hashSecret}:email:${verifiedEmail}`);
    const { data: challenge } = await adminClient.from('password_reset_challenges')
      .select('password_updated_at, consumed_at')
      .eq('email_hash', emailHash)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!challenge?.password_updated_at || challenge.consumed_at) {
      return jsonResponse({ error: 'Password reset is not ready to finalize.' }, 400);
    }

    const { error: signOutError } = await adminClient.auth.admin.signOut(accessToken, 'global');
    if (signOutError) return jsonResponse({ error: 'Unable to invalidate active sessions.' }, 500);
    await adminClient.from('password_reset_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('email_hash', emailHash);
    await audit(adminClient, {
      user_id: userData.user.id,
      email_hash: emailHash,
      ip_hash: ipHash,
      event_type: 'reset_completed'
    });
    return jsonResponse({ message: 'Sessions invalidated.' });
  }

  return jsonResponse({ error: 'Invalid password reset action.' }, 400);
});
