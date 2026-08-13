import { corsHeaders, jsonResponse, verifiedUser } from '../_shared/http.ts';

const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await verifiedUser(request);
  if (auth instanceof Response) return auth;

  const providers = Array.isArray(auth.user.app_metadata?.providers) ? auth.user.app_metadata.providers : [];
  const googleIdentity = auth.user.app_metadata?.provider === 'google' || providers.includes('google');
  if (!googleIdentity) {
    return jsonResponse(409, { code: 'google_account_required', message: 'This password setup is only required for Google accounts.' });
  }

  let body: { password?: unknown };
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_request', message: 'Enter a secure password.' }); }
  const password = typeof body.password === 'string' ? body.password : '';
  if (!strongPassword.test(password)) {
    return jsonResponse(400, {
      code: 'weak_password',
      message: 'Use 8–72 characters with an uppercase letter, lowercase letter, and number.',
    });
  }

  const updated = await auth.serviceClient.auth.admin.updateUserById(auth.user.id, { password });
  if (updated.error) {
    return jsonResponse(503, { code: 'password_update_failed', message: 'Your password could not be saved. Please try again.' });
  }
  const marked = await auth.serviceClient.from('jela_accounts').update({
    google_identity: true,
    password_set_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', auth.user.id);
  if (marked.error) {
    return jsonResponse(503, { code: 'password_status_failed', message: 'Your password was saved, but setup could not be finalized. Please try again.' });
  }
  await auth.serviceClient.from('jela_security_events').insert({
    actor_id: auth.user.id,
    subject_id: auth.user.id,
    event_type: 'auth.google_password_set',
    severity: 'info',
    metadata: { session_id: auth.sessionId },
  });
  return jsonResponse(200, { passwordSet: true });
});
