import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type PushTarget = { id: string; user_id: string; expo_push_token: string };
type PushContent = { title: string; body: string; data: Record<string, unknown> };

const expoUrl = 'https://exp.host/--/api/v2/push/send';
const expoReceiptsUrl = 'https://exp.host/--/api/v2/push/getReceipts';

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

export async function sendPushNotification(
  serviceClient: SupabaseClient,
  notificationId: string,
  targets: PushTarget[],
  content: PushContent,
) {
  if (!targets.length) {
    await serviceClient.from('jela_notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', notificationId);
    return { accepted: 0, failed: 0 };
  }
  await serviceClient.from('jela_notification_deliveries').upsert(targets.map((target) => ({
    notification_id: notificationId, token_id: target.id, user_id: target.user_id, status: 'queued',
  })), { onConflict: 'notification_id,token_id' });

  let accepted = 0;
  let failed = 0;
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  for (const batch of chunks(targets, 100)) {
    try {
      const response = await fetch(expoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(batch.map((target) => ({
          to: target.expo_push_token,
          title: content.title,
          body: content.body,
          data: content.data,
          sound: 'default',
          channelId: 'jela-general',
          priority: 'high',
        }))),
      });
      const payload = await response.json().catch(() => null) as { data?: Array<{ status?: string; id?: string; message?: string; details?: { error?: string } }> } | null;
      if (!response.ok || !Array.isArray(payload?.data)) throw new Error(`expo_push_${response.status}`);
      for (let index = 0; index < batch.length; index += 1) {
        const target = batch[index];
        const ticket = payload.data[index];
        if (ticket?.status === 'ok' && ticket.id) {
          accepted += 1;
          await serviceClient.from('jela_notification_deliveries').update({ status: 'accepted', ticket_id: ticket.id })
            .eq('notification_id', notificationId).eq('token_id', target.id);
        } else {
          failed += 1;
          const errorCode = ticket?.details?.error ?? 'push_rejected';
          await serviceClient.from('jela_notification_deliveries').update({
            status: 'failed', error_code: errorCode, error_message: ticket?.message ?? 'The push service rejected this device.',
          }).eq('notification_id', notificationId).eq('token_id', target.id);
          if (errorCode === 'DeviceNotRegistered') {
            await serviceClient.from('jela_push_tokens').update({ enabled: false, disabled_reason: errorCode })
              .eq('id', target.id);
          }
        }
      }
    } catch (error) {
      failed += batch.length;
      await serviceClient.from('jela_notification_deliveries').update({
        status: 'failed', error_code: 'provider_unavailable',
        error_message: error instanceof Error ? error.message.slice(0, 200) : 'Push provider unavailable.',
      }).eq('notification_id', notificationId).in('token_id', batch.map((target) => target.id));
    }
  }
  await serviceClient.from('jela_notifications').update({
    status: failed === 0 ? 'sent' : accepted > 0 ? 'partial' : 'failed',
    recipient_count: targets.length,
    delivered_count: accepted,
    failed_count: failed,
    sent_at: new Date().toISOString(),
  }).eq('id', notificationId);
  return { accepted, failed };
}

export async function reconcilePushReceipts(serviceClient: SupabaseClient) {
  const pending = await serviceClient.from('jela_notification_deliveries')
    .select('id,ticket_id,token_id')
    .eq('status', 'accepted').not('ticket_id', 'is', null)
    .lt('created_at', new Date(Date.now() - 15 * 60_000).toISOString())
    .order('created_at', { ascending: true }).limit(1000);
  if (!pending.data?.length) return { checked: 0 };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  let checked = 0;
  for (const batch of chunks(pending.data, 1000)) {
    const response = await fetch(expoReceiptsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Accept': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ ids: batch.map((item) => item.ticket_id) }),
    });
    const payload = await response.json().catch(() => null) as {
      data?: Record<string, { status?: string; message?: string; details?: { error?: string } }>;
    } | null;
    if (!response.ok || !payload?.data) continue;
    for (const item of batch) {
      const receipt = payload.data[String(item.ticket_id)];
      if (!receipt) continue;
      checked += 1;
      const success = receipt.status === 'ok';
      const errorCode = receipt.details?.error ?? (success ? null : 'delivery_failed');
      await serviceClient.from('jela_notification_deliveries').update({
        status: success ? 'delivered' : 'failed',
        error_code: errorCode,
        error_message: success ? null : receipt.message ?? 'The device did not accept this notification.',
        receipt_checked_at: new Date().toISOString(),
      }).eq('id', item.id);
      if (errorCode === 'DeviceNotRegistered') {
        await serviceClient.from('jela_push_tokens').update({ enabled: false, disabled_reason: errorCode }).eq('id', item.token_id);
      }
    }
  }
  return { checked };
}

export async function notifyUserWhenAway(
  serviceClient: SupabaseClient,
  userId: string,
  content: PushContent,
) {
  const notification = await serviceClient.from('jela_notifications').insert({
    audience: 'user', target_user_id: userId, kind: String(content.data.kind ?? 'system'),
    title: content.title, body: content.body, data: content.data, status: 'sending',
  }).select('id').single();
  if (!notification.data) return;
  const cutoff = new Date(Date.now() - 90_000).toISOString();
  const tokens = await serviceClient.from('jela_push_tokens').select('id,user_id,expo_push_token')
    .eq('user_id', userId).eq('enabled', true).eq('permission_status', 'granted')
    .not('expo_push_token', 'is', null)
    .or(`app_state.neq.active,last_seen_at.lt.${cutoff}`);
  await sendPushNotification(serviceClient, notification.data.id, (tokens.data ?? []) as PushTarget[], content);
}
