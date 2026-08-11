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

export async function authenticatedUser(
  request: Request,
): Promise<{ user: User; userClient: SupabaseClient; serviceClient: SupabaseClient } | Response> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(401, { code: 'authentication_required', message: 'Sign in to continue.' });
  }
  try {
    const { userClient, serviceClient } = serverClients(authorization);
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) {
      return jsonResponse(401, { code: 'invalid_session', message: 'Your session has expired. Sign in again to continue.' });
    }
    return { user: data.user, userClient, serviceClient };
  } catch {
    return jsonResponse(503, { code: 'backend_unavailable', message: 'Unable to complete that request right now.' });
  }
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

