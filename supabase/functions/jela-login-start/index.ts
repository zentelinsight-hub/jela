import { authenticatedUser, corsHeaders, jsonResponse, serverClients, verifiedUser } from '../_shared/http.ts';

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return 'your email';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.toLowerCase()));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  let body: { purpose?: unknown } = {};
  try { body = await request.json(); } catch { /* Purpose defaults to login. */ }
  const purpose = body.purpose === 'sensitive_action' ? 'sensitive_action' : 'login';
  const auth = purpose === 'sensitive_action' ? await verifiedUser(request) : await authenticatedUser(request);
  if (auth instanceof Response) return auth;
  if (!auth.user.email || !auth.user.email_confirmed_at) {
    return jsonResponse(409, { code: 'confirmed_email_required', message: 'Confirm your account email before continuing.' });
  }

  const methods = new Set(auth.authMethods);
  const firstFactorMethod = methods.has('password') ? 'password'
    : methods.has('oauth') || methods.has('google') ? 'oauth'
      : methods.has('sso') ? 'sso'
        : null;
  if (purpose === 'login' && !firstFactorMethod) {
    return jsonResponse(403, { code: 'first_factor_required', message: 'Sign in with your password or Google before requesting a code.' });
  }

  const now = Date.now();
  const pending = await auth.serviceClient.from('jela_login_challenges')
    .select('id,resend_available_at,expires_at,resend_count,max_attempts')
    .eq('user_id', auth.user.id).eq('first_factor_session_id', auth.sessionId)
    .eq('purpose', purpose).eq('status', 'pending').gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (pending.error) return jsonResponse(503, { code: 'challenge_unavailable', message: 'A verification code could not be prepared.' });

  let challengeId: string;
  let resendCount = 0;
  if (pending.data) {
    const waitMs = new Date(pending.data.resend_available_at).getTime() - now;
    if (waitMs > 0) {
      return jsonResponse(200, {
        code: 'resend_cooldown',
        message: `Wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code.`,
        challengeId: pending.data.id,
        resendIn: Math.ceil(waitMs / 1000),
        expiresAt: pending.data.expires_at,
        maskedEmail: maskEmail(auth.user.email),
        maxAttempts: pending.data.max_attempts,
      });
    }
    if (pending.data.resend_count >= 5) {
      return jsonResponse(429, { code: 'resend_limit_reached', message: 'Too many codes were requested. Sign in again and retry later.' });
    }
    challengeId = pending.data.id;
    resendCount = pending.data.resend_count + 1;
  } else {
    const inserted = await auth.serviceClient.from('jela_login_challenges').insert({
      user_id: auth.user.id,
      first_factor_session_id: auth.sessionId,
      first_factor_method: purpose === 'sensitive_action' ? 'sensitive_action' : firstFactorMethod,
      purpose,
      email_hash: await sha256(auth.user.email),
      resend_available_at: new Date(now + 60_000).toISOString(),
      expires_at: new Date(now + 10 * 60_000).toISOString(),
    }).select('id').single();
    if (inserted.error) return jsonResponse(503, { code: 'challenge_unavailable', message: 'A verification code could not be prepared.' });
    challengeId = inserted.data.id;
  }

  const { userClient } = serverClients();
  const sent = await userClient.auth.signInWithOtp({
    email: auth.user.email,
    options: { shouldCreateUser: false },
  });
  if (sent.error) {
    await auth.serviceClient.from('jela_login_challenges').update({ status: 'delivery_failed' }).eq('id', challengeId);
    return jsonResponse(502, { code: 'email_delivery_failed', message: 'The verification email could not be sent. Please try again.' });
  }
  if (pending.data) {
    await auth.serviceClient.from('jela_login_challenges').update({
      resend_count: resendCount,
      resend_available_at: new Date(now + 60_000).toISOString(),
      expires_at: new Date(now + 10 * 60_000).toISOString(),
    }).eq('id', challengeId);
  }

  await auth.serviceClient.from('jela_security_events').insert({
    actor_id: auth.user.id,
    subject_id: auth.user.id,
    event_type: purpose === 'login' ? 'auth.email_challenge_sent' : 'auth.sensitive_challenge_sent',
    metadata: { challenge_id: challengeId, session_id: auth.sessionId, resend_count: resendCount },
  });
  return jsonResponse(200, {
    challengeId,
    maskedEmail: maskEmail(auth.user.email),
    expiresAt: new Date(now + 10 * 60_000).toISOString(),
    resendIn: 60,
    maxAttempts: 5,
  });
});
