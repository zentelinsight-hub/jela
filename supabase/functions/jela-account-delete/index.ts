import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { adminUser, corsHeaders, jsonResponse, paystackRequest, verifiedUser } from '../_shared/http.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function deleteStoragePrefix(
  serviceClient: SupabaseClient,
  bucket: string,
  prefix: string,
) {
  const pending = [prefix];
  const files: string[] = [];
  while (pending.length > 0) {
    const current = pending.shift()!;
    let offset = 0;
    while (true) {
      const listed = await serviceClient.storage.from(bucket).list(current, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (listed.error) throw listed.error;
      const entries = listed.data ?? [];
      for (const entry of entries) {
        const path = `${current}/${entry.name}`;
        if (entry.id || entry.metadata) files.push(path); else pending.push(path);
      }
      if (entries.length < 100) break;
      offset += entries.length;
    }
  }
  for (let index = 0; index < files.length; index += 100) {
    const removed = await serviceClient.storage.from(bucket).remove(files.slice(index, index + 100));
    if (removed.error) throw removed.error;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  let body: { targetUserId?: unknown; confirmation?: unknown };
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_request', message: 'Confirm the account deletion request.' }); }
  const requestedTarget = typeof body.targetUserId === 'string' && uuidPattern.test(body.targetUserId) ? body.targetUserId : null;
  const initial = await verifiedUser(request);
  if (initial instanceof Response) return initial;
  const targetUserId = requestedTarget ?? initial.user.id;
  const deletingAnotherUser = targetUserId !== initial.user.id;
  const auth = deletingAnotherUser ? await adminUser(request) : initial;
  if (auth instanceof Response) return auth;
  if (body.confirmation !== 'DELETE') {
    return jsonResponse(400, { code: 'confirmation_required', message: 'Type DELETE to confirm permanent account deletion.' });
  }
  const targetRole = await auth.serviceClient.from('jela_account_roles').select('role')
    .eq('user_id', targetUserId).eq('role', 'admin').maybeSingle();
  if (targetRole.data) {
    return jsonResponse(409, { code: 'protected_admin_account', message: 'Administrator accounts cannot be deleted from this workflow.' });
  }
  const target = await auth.serviceClient.auth.admin.getUserById(targetUserId);
  if (target.error || !target.data.user) return jsonResponse(404, { code: 'account_not_found', message: 'That account no longer exists.' });

  const subscriptions = await auth.serviceClient.from('jela_subscriptions')
    .select('id,provider_subscription_id,provider_email_token')
    .eq('user_id', targetUserId).in('status', ['active', 'trialing', 'past_due', 'grace_period']);
  if (subscriptions.error) return jsonResponse(503, { code: 'deletion_failed', message: 'The account could not be prepared for deletion.' });
  for (const subscription of subscriptions.data ?? []) {
    if (!subscription.provider_subscription_id || !subscription.provider_email_token) {
      return jsonResponse(409, { code: 'subscription_cancellation_required', message: 'An active subscription must be cancelled before this account can be deleted.' });
    }
    try {
      await paystackRequest('/subscription/disable', {
        method: 'POST',
        body: JSON.stringify({ code: subscription.provider_subscription_id, token: subscription.provider_email_token }),
      });
    } catch {
      return jsonResponse(502, { code: 'subscription_cancellation_failed', message: 'The active subscription could not be cancelled, so the account was not deleted.' });
    }
  }

  try {
    await Promise.all([
      deleteStoragePrefix(auth.serviceClient, 'jela-attachments', targetUserId),
      deleteStoragePrefix(auth.serviceClient, 'jela-avatars', targetUserId),
      deleteStoragePrefix(auth.serviceClient, 'jela-generated-images', targetUserId),
      deleteStoragePrefix(auth.serviceClient, 'jela-workspace-files', targetUserId),
    ]);
  } catch {
    return jsonResponse(503, { code: 'storage_cleanup_failed', message: 'Private files could not be removed, so the account was not deleted.' });
  }
  await auth.serviceClient.from('jela_audit_logs').insert({
    actor_id: auth.user.id, action: deletingAnotherUser ? 'account.admin_deleted' : 'account.self_deleted',
    target_type: 'account', target_id: targetUserId,
    metadata: { subscriptions_cancelled: subscriptions.data?.length ?? 0 },
  });
  const deleted = await auth.serviceClient.auth.admin.deleteUser(targetUserId, false);
  if (deleted.error) return jsonResponse(503, { code: 'deletion_failed', message: 'The account could not be deleted.' });
  return jsonResponse(200, { deleted: true });
});
