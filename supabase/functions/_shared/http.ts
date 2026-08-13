import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function serverClients(authorization?: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('backend_not_configured');
  return {
    userClient: createClient(supabaseUrl, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    serviceClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

type SessionClaims = {
  sessionId: string | null;
  authMethods: string[];
};

function decodeJwtPayload(authorization: string): Record<string, unknown> {
  const token = authorization.slice('Bearer '.length);
  const payload = token.split('.')[1];
  if (!payload) return {};
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sessionClaims(authorization: string): SessionClaims {
  const payload = decodeJwtPayload(authorization);
  const amr = Array.isArray(payload.amr) ? payload.amr : [];
  return {
    sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
    authMethods: amr
      .map((entry) => typeof entry === 'object' && entry && 'method' in entry ? String(entry.method) : '')
      .filter(Boolean),
  };
}

export type AuthenticatedRequest = {
  user: User;
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
  authorization: string;
  sessionId: string;
  authMethods: string[];
};

export async function syncGoogleIdentityProfile(auth: AuthenticatedRequest) {
  const metadata = auth.user.user_metadata ?? {};
  const providers = Array.isArray(auth.user.app_metadata?.providers) ? auth.user.app_metadata.providers : [];
  const isGoogle = auth.user.app_metadata?.provider === 'google' || providers.includes('google');
  if (!isGoogle) return;
  const current = await auth.serviceClient.from('jela_accounts')
    .select('first_name,last_name,display_name,avatar_url,avatar_path,google_identity')
    .eq('id', auth.user.id).maybeSingle();
  if (current.error || !current.data) return;
  const fullName = String(metadata.full_name ?? metadata.name ?? '').trim();
  const givenName = String(metadata.given_name ?? metadata.first_name ?? fullName.split(/\s+/)[0] ?? '').trim();
  const familyName = String(
    metadata.family_name ?? metadata.last_name ?? fullName.split(/\s+/).slice(1).join(' '),
  ).trim();
  const avatar = String(metadata.avatar_url ?? metadata.picture ?? '').trim();
  const patch: Record<string, unknown> = {};
  if (!current.data.google_identity) patch.google_identity = true;
  if (!current.data.first_name.trim() && givenName) patch.first_name = givenName.slice(0, 60);
  if (!current.data.last_name.trim() && familyName) patch.last_name = familyName.slice(0, 60);
  if (!current.data.display_name && fullName) patch.display_name = fullName.slice(0, 100);
  if (!current.data.avatar_path && !current.data.avatar_url && avatar.startsWith('https://')) patch.avatar_url = avatar;
  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    await auth.serviceClient.from('jela_accounts').update(patch).eq('id', auth.user.id);
  }
}

export async function authenticatedUser(
  request: Request,
): Promise<AuthenticatedRequest | Response> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(401, { code: 'authentication_required', message: 'Sign in to continue.' });
  }
  try {
    const claims = sessionClaims(authorization);
    if (!claims.sessionId) {
      return jsonResponse(401, { code: 'invalid_session', message: 'Your session has expired. Sign in again to continue.' });
    }
    const { userClient, serviceClient } = serverClients(authorization);
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) {
      return jsonResponse(401, { code: 'invalid_session', message: 'Your session has expired. Sign in again to continue.' });
    }
    return {
      user: data.user,
      userClient,
      serviceClient,
      authorization,
      sessionId: claims.sessionId,
      authMethods: claims.authMethods,
    };
  } catch {
    return jsonResponse(503, { code: 'backend_unavailable', message: 'Unable to complete that request right now.' });
  }
}

export async function verifiedUser(request: Request): Promise<AuthenticatedRequest | Response> {
  // Kept as a compatibility boundary for existing protected functions. A valid
  // Supabase session is now the only sign-in gate; the email OTP second step
  // has been retired from the product.
  return authenticatedUser(request);
}

export async function adminUser(request: Request): Promise<AuthenticatedRequest | Response> {
  const auth = await verifiedUser(request);
  if (auth instanceof Response) return auth;
  const [role, access] = await Promise.all([
    auth.serviceClient.from('jela_account_roles').select('role')
      .eq('user_id', auth.user.id).eq('role', 'admin').maybeSingle(),
    auth.serviceClient.from('jela_admin_session_grants').select('session_id')
      .eq('session_id', auth.sessionId).eq('user_id', auth.user.id)
      .is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle(),
  ]);
  if (role.error || !role.data) {
    return jsonResponse(403, { code: 'admin_required', message: 'Administrator access is required.' });
  }
  if (access.error || !access.data) {
    return jsonResponse(403, { code: 'admin_access_code_required', message: 'Enter the administrator access code to continue.' });
  }
  return auth;
}

export async function paystackRequest(path: string, init?: RequestInit) {
  const secret = Deno.env.get('PAYSTACK_API_KEY');
  if (!secret) throw new Error('paystack_not_configured');
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload || payload.status !== true) throw new Error(`paystack_${response.status}`);
  return payload;
}
