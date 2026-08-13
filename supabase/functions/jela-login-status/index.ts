import { authenticatedUser, corsHeaders, jsonResponse, syncGoogleIdentityProfile } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await authenticatedUser(request);
  if (auth instanceof Response) return auth;

  const now = new Date().toISOString();
  await syncGoogleIdentityProfile(auth);

  const [account, roles, adminAccess] = await Promise.all([
    auth.serviceClient.from('jela_accounts')
      .select('id,first_name,last_name,display_name,username,age,avatar_url,avatar_path,status,profile_completed_at,google_identity,password_set_at,created_at,updated_at')
      .eq('id', auth.user.id).maybeSingle(),
    auth.serviceClient.from('jela_account_roles').select('role').eq('user_id', auth.user.id),
    auth.serviceClient.from('jela_admin_session_grants').select('expires_at')
      .eq('session_id', auth.sessionId).eq('user_id', auth.user.id)
      .is('revoked_at', null).gt('expires_at', now).maybeSingle(),
  ]);
  if (account.error || roles.error) {
    return jsonResponse(503, { code: 'account_unavailable', message: 'Your account could not be loaded right now.' });
  }
  const roleNames = (roles.data ?? []).map((entry) => entry.role);
  return jsonResponse(200, {
    authenticated: true,
    account: account.data,
    roles: roleNames,
    profileComplete: Boolean(
      account.data?.profile_completed_at
      && account.data?.first_name?.trim().length >= 2
      && account.data?.last_name?.trim().length >= 2
      && account.data?.username
      && account.data?.age
      && (!account.data?.google_identity || account.data?.password_set_at),
    ),
    adminAccessGranted: roleNames.includes('admin') && Boolean(adminAccess.data) && !adminAccess.error,
  });
});
