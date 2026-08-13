import { adminUser, corsHeaders, jsonResponse, verifiedUser } from '../_shared/http.ts';

function hex(bytes: ArrayBuffer | Uint8Array) {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(value).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error('invalid_hash');
  return new Uint8Array(value.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function derive(code: string, saltHex: string, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256,
  ));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  let body: { mode?: unknown; code?: unknown; newCode?: unknown };
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_request', message: 'Enter the administrator access code.' }); }
  const mode = body.mode === 'rotate' ? 'rotate' : 'verify';

  if (mode === 'rotate') {
    const auth = await adminUser(request);
    if (auth instanceof Response) return auth;
    const newCode = typeof body.newCode === 'string' ? body.newCode.trim() : '';
    if (newCode.length < 8 || newCode.length > 64) {
      return jsonResponse(400, { code: 'invalid_new_code', message: 'Use an access code between 8 and 64 characters.' });
    }
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iterations = 210000;
    const hashHex = await derive(newCode, hex(salt), iterations);
    const saved = await auth.serviceClient.from('jela_admin_access_config').upsert({
      singleton: true, salt_hex: hex(salt), hash_hex: hashHex, iterations,
      updated_by: auth.user.id, updated_at: new Date().toISOString(),
    });
    if (saved.error) return jsonResponse(503, { code: 'rotation_failed', message: 'The access code could not be rotated.' });
    await auth.serviceClient.from('jela_admin_session_grants').update({ revoked_at: new Date().toISOString() })
      .neq('session_id', auth.sessionId).is('revoked_at', null);
    await auth.serviceClient.from('jela_audit_logs').insert({
      actor_id: auth.user.id, action: 'admin.access_code_rotated', target_type: 'security',
      metadata: { session_id: auth.sessionId },
    });
    return jsonResponse(200, { rotated: true });
  }

  const auth = await verifiedUser(request);
  if (auth instanceof Response) return auth;
  const role = await auth.serviceClient.from('jela_account_roles').select('role')
    .eq('user_id', auth.user.id).eq('role', 'admin').maybeSingle();
  if (role.error || !role.data) return jsonResponse(403, { code: 'admin_required', message: 'Administrator access is required.' });
  const code = typeof body.code === 'string' ? body.code : '';
  if (!code || code.length > 128) return jsonResponse(400, { code: 'invalid_code', message: 'Enter the administrator access code.' });

  const existingGrant = await auth.serviceClient.from('jela_admin_session_grants')
    .select('failed_attempts,last_attempt_at')
    .eq('session_id', auth.sessionId).eq('user_id', auth.user.id).maybeSingle();
  const withinLockWindow = existingGrant.data?.last_attempt_at
    && Date.now() - new Date(existingGrant.data.last_attempt_at).getTime() < 15 * 60_000;
  if (withinLockWindow && (existingGrant.data?.failed_attempts ?? 0) >= 5) {
    return jsonResponse(429, { code: 'admin_access_locked', message: 'Too many attempts. Wait 15 minutes and try again.' });
  }

  const dbConfig = await auth.serviceClient.from('jela_admin_access_config')
    .select('salt_hex,hash_hex,iterations').eq('singleton', true).maybeSingle();
  let saltHex: string;
  let hashHex: string;
  let iterations: number;
  if (dbConfig.data) {
    ({ salt_hex: saltHex, hash_hex: hashHex, iterations } = dbConfig.data);
  } else {
    const fallback = Deno.env.get('JELA_ADMIN_ACCESS_CODE_HASH') ?? '';
    const parts = fallback.split(':');
    iterations = Number(parts[0]);
    saltHex = parts[1] ?? '';
    hashHex = parts[2] ?? '';
    if (!Number.isInteger(iterations) || !saltHex || !hashHex) {
      return jsonResponse(503, { code: 'admin_access_not_configured', message: 'Administrator access is not configured.' });
    }
  }

  const valid = constantTimeEqual(await derive(code, saltHex, iterations), hashHex);
  if (!valid) {
    const failedAttempts = withinLockWindow ? (existingGrant.data?.failed_attempts ?? 0) + 1 : 1;
    await auth.serviceClient.from('jela_admin_session_grants').upsert({
      session_id: auth.sessionId, user_id: auth.user.id,
      granted_at: new Date(0).toISOString(), expires_at: new Date(0).toISOString(),
      revoked_at: new Date().toISOString(), failed_attempts: failedAttempts,
      last_attempt_at: new Date().toISOString(),
    });
    await auth.serviceClient.from('jela_security_events').insert({
      actor_id: auth.user.id, subject_id: auth.user.id, event_type: 'admin.access_denied',
      severity: failedAttempts >= 5 ? 'warning' : 'info',
      metadata: { session_id: auth.sessionId, attempt: failedAttempts },
    });
    return jsonResponse(401, { code: 'incorrect_admin_code', message: 'That administrator access code is incorrect.' });
  }

  const expiresAt = new Date(Date.now() + 8 * 60 * 60_000).toISOString();
  const granted = await auth.serviceClient.from('jela_admin_session_grants').upsert({
    session_id: auth.sessionId, user_id: auth.user.id, granted_at: new Date().toISOString(),
    expires_at: expiresAt, revoked_at: null, failed_attempts: 0, last_attempt_at: new Date().toISOString(),
  });
  if (granted.error) return jsonResponse(503, { code: 'admin_access_failed', message: 'Administrator access could not be completed.' });
  await auth.serviceClient.from('jela_audit_logs').insert({
    actor_id: auth.user.id, action: 'admin.access_granted', target_type: 'session',
    target_id: auth.sessionId, metadata: { expires_at: expiresAt },
  });
  return jsonResponse(200, { granted: true, expiresAt });
});
