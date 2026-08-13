import { adminUser, corsHeaders, jsonResponse } from '../_shared/http.ts';
import { reconcilePushReceipts, sendPushNotification } from '../_shared/push.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await adminUser(request);
  if (auth instanceof Response) return auth;
  await reconcilePushReceipts(auth.serviceClient).catch(() => undefined);
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_request', message: 'Enter a title and message.' }); }
  const title = String(body.title ?? '').trim();
  const message = String(body.body ?? '').trim();
  if (!title || title.length > 80 || !message || message.length > 280) {
    return jsonResponse(400, { code: 'invalid_notification', message: 'Use a title up to 80 characters and a message up to 280 characters.' });
  }
  const notification = await auth.serviceClient.from('jela_notifications').insert({
    actor_id: auth.user.id, audience: 'all', kind: 'admin_broadcast', title, body: message,
    data: { kind: 'admin_broadcast' }, status: 'sending',
  }).select('id').single();
  if (!notification.data) return jsonResponse(503, { code: 'notification_failed', message: 'The broadcast could not be created.' });
  const tokens = await auth.serviceClient.from('jela_push_tokens').select('id,user_id,expo_push_token')
    .eq('enabled', true).eq('permission_status', 'granted').not('expo_push_token', 'is', null);
  const delivery = await sendPushNotification(auth.serviceClient, notification.data.id, tokens.data ?? [], {
    title, body: message, data: { kind: 'admin_broadcast', notificationId: notification.data.id },
  });
  await auth.serviceClient.from('jela_audit_logs').insert({
    actor_id: auth.user.id, action: 'notification.broadcast', target_type: 'notification', target_id: notification.data.id,
    metadata: { recipient_count: tokens.data?.length ?? 0, ...delivery },
  });
  return jsonResponse(200, { notificationId: notification.data.id, recipientCount: tokens.data?.length ?? 0, ...delivery });
});
