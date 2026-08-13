import { authenticatedUser, corsHeaders, jsonResponse, serverClients, syncGoogleIdentityProfile } from '../_shared/http.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jwtSessionId(token: string) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload = JSON.parse(atob(normalized)) as { session_id?: unknown };
    return typeof payload.session_id === 'string' ? payload.session_id : null;
  } catch { return null; }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await authenticatedUser(request);
  if (auth instanceof Response) return auth;
  let body: { challengeId?: unknown; code?: unknown };
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_request', message: 'Enter the 6-digit code.' }); }
  const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
  if (!uuidPattern.test(challengeId) || !/^\d{6}$/.test(code)) {
    return jsonResponse(400, { code: 'invalid_code', message: 'Enter all 6 digits from your email.' });
  }
  if (!auth.user.email) return jsonResponse(409, { code: 'confirmed_email_required', message: 'A confirmed account email is required.' });

  const challenge = await auth.serviceClient.from('jela_login_challenges')
    .select('id,status,attempts,max_attempts,expires_at,purpose')
    .eq('id', challengeId).eq('user_id', auth.user.id)
    .eq('first_factor_session_id', auth.sessionId).maybeSingle();
  if (challenge.error || !challenge.data || challenge.data.status !== 'pending') {
    return jsonResponse(409, { code: 'challenge_unavailable', message: 'This verification request is no longer available. Request a new code.' });
  }
  if (new Date(challenge.data.expires_at).getTime() <= Date.now()) {
    await auth.serviceClient.from('jela_login_challenges').update({ status: 'expired' }).eq('id', challengeId);
    return jsonResponse(410, { code: 'code_expired', message: 'That code has expired. Request a new one.' });
  }
  const nextAttempts = challenge.data.attempts + 1;
  await auth.serviceClient.from('jela_login_challenges').update({ attempts: nextAttempts }).eq('id', challengeId);
  if (nextAttempts > challenge.data.max_attempts) {
    await auth.serviceClient.from('jela_login_challenges').update({ status: 'locked' }).eq('id', challengeId);
    return jsonResponse(429, { code: 'attempt_limit_reached', message: 'Too many incorrect attempts. Sign in again to request a new code.' });
  }

  const { userClient } = serverClients();
  const verified = await userClient.auth.verifyOtp({ email: auth.user.email, token: code, type: 'email' });
  const finalSession = verified.data.session;
  if (verified.error || !finalSession || verified.data.user?.id !== auth.user.id) {
    if (nextAttempts >= challenge.data.max_attempts) {
      await auth.serviceClient.from('jela_login_challenges').update({ status: 'locked' }).eq('id', challengeId);
    }
    await auth.serviceClient.from('jela_security_events').insert({
      actor_id: auth.user.id, subject_id: auth.user.id, event_type: 'auth.email_challenge_failed',
      severity: nextAttempts >= challenge.data.max_attempts ? 'warning' : 'info',
      metadata: { challenge_id: challengeId, attempt: nextAttempts },
    });
    return jsonResponse(401, { code: 'incorrect_code', message: 'That code is incorrect or no longer active.' });
  }
  const finalSessionId = jwtSessionId(finalSession.access_token);
  if (!finalSessionId || !uuidPattern.test(finalSessionId)) {
    return jsonResponse(503, { code: 'session_verification_failed', message: 'The secure session could not be completed. Please sign in again.' });
  }
  const verificationExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
  const stored = await auth.serviceClient.from('jela_session_verifications').upsert({
    session_id: finalSessionId,
    user_id: auth.user.id,
    challenge_id: challengeId,
    verified_at: new Date().toISOString(),
    expires_at: verificationExpiresAt,
    revoked_at: null,
  });
  if (stored.error) return jsonResponse(503, { code: 'session_verification_failed', message: 'The secure session could not be completed. Please sign in again.' });
  await auth.serviceClient.from('jela_login_challenges').update({
    status: 'completed', final_session_id: finalSessionId, completed_at: new Date().toISOString(),
  }).eq('id', challengeId);
  await syncGoogleIdentityProfile(auth);
  const [account, roles] = await Promise.all([
    auth.serviceClient.from('jela_accounts').select('first_name,last_name,profile_completed_at,username,age,status,google_identity,password_set_at').eq('id', auth.user.id).maybeSingle(),
    auth.serviceClient.from('jela_account_roles').select('role').eq('user_id', auth.user.id),
  ]);
  await auth.serviceClient.from('jela_security_events').insert({
    actor_id: auth.user.id, subject_id: auth.user.id, event_type: 'auth.email_challenge_completed',
    metadata: { challenge_id: challengeId, session_id: finalSessionId, purpose: challenge.data.purpose },
  });
  return jsonResponse(200, {
    accessToken: finalSession.access_token,
    refreshToken: finalSession.refresh_token,
    expiresAt: finalSession.expires_at ?? null,
    verificationExpiresAt,
    profileComplete: Boolean(
      account.data?.profile_completed_at
      && account.data?.first_name?.trim().length >= 2
      && account.data?.last_name?.trim().length >= 2
      && account.data?.username
      && account.data?.age
      && (!account.data?.google_identity || account.data?.password_set_at),
    ),
    accountStatus: account.data?.status ?? null,
    isAdmin: (roles.data ?? []).some((entry) => entry.role === 'admin'),
  });
});
