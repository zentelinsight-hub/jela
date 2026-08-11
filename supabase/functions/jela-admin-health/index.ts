import { authenticatedUser, corsHeaders, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await authenticatedUser(request);
  if (auth instanceof Response) return auth;
  const role = await auth.userClient.from('jela_account_roles').select('role').eq('user_id', auth.user.id).eq('role', 'admin').maybeSingle();
  if (role.error || !role.data) return jsonResponse(403, { code: 'admin_required', message: 'Admin access is required.' });
  return jsonResponse(200, {
    openai: Deno.env.get('OPENAI_API_KEY') ? 'configured' : 'unavailable',
    paystack: Deno.env.get('PAYSTACK_API_KEY') ? 'configured' : 'unavailable',
  });
});
