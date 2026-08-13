import { createHash } from 'node:crypto';
import { corsHeaders, jsonResponse, verifiedUser } from '../_shared/http.ts';

const tokenPattern = /^(Exponent|Expo)PushToken\[[^\]]+\]$/;
const states = new Set(['active', 'background', 'inactive', 'unknown']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await verifiedUser(request);
  if (auth instanceof Response) return auth;
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_request', message: 'Invalid notification request.' }); }
  const action = String(body.action ?? 'status');

  if (action === 'register') {
    const token = String(body.token ?? '');
    const installationId = String(body.installationId ?? '').slice(0, 100);
    if (!tokenPattern.test(token) || installationId.length < 10) {
      return jsonResponse(400, { code: 'invalid_device', message: 'This device could not be registered.' });
    }
    const row = await auth.serviceClient.from('jela_push_tokens').upsert({
      user_id: auth.user.id,
      token_hash: createHash('sha256').update(token).digest('hex'),
      expo_push_token: token,
      installation_id: installationId,
      platform: 'android',
      enabled: true,
      permission_status: 'granted',
      app_state: 'active',
      device_name: String(body.deviceName ?? 'Android device').slice(0, 100),
      app_version: String(body.appVersion ?? '').slice(0, 30),
      disabled_reason: null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'user_id,installation_id' });
    if (row.error) return jsonResponse(503, { code: 'registration_failed', message: 'Notifications could not be enabled.' });
    await auth.serviceClient.from('jela_devices').upsert({
      owner_id: auth.user.id, installation_id: installationId, platform: 'android',
      device_name: String(body.deviceName ?? 'Android device').slice(0, 100),
      app_version: String(body.appVersion ?? '').slice(0, 30), last_seen_at: new Date().toISOString(), revoked_at: null,
    }, { onConflict: 'owner_id,installation_id' });
    await auth.serviceClient.from('jela_user_settings').update({ notifications_enabled: true }).eq('user_id', auth.user.id);
    return jsonResponse(200, { enabled: true, permissionStatus: 'granted' });
  }

  if (action === 'disable') {
    const installationId = String(body.installationId ?? '');
    await auth.serviceClient.from('jela_push_tokens').update({
      enabled: false, permission_status: String(body.permissionStatus ?? 'denied'),
      disabled_reason: 'user_disabled', last_seen_at: new Date().toISOString(),
    }).eq('user_id', auth.user.id).eq('installation_id', installationId);
    await auth.serviceClient.from('jela_user_settings').update({ notifications_enabled: false }).eq('user_id', auth.user.id);
    return jsonResponse(200, { enabled: false, permissionStatus: String(body.permissionStatus ?? 'denied') });
  }

  if (action === 'state') {
    const appState = states.has(String(body.appState)) ? String(body.appState) : 'unknown';
    await auth.serviceClient.from('jela_push_tokens').update({ app_state: appState, last_seen_at: new Date().toISOString() })
      .eq('user_id', auth.user.id).eq('installation_id', String(body.installationId ?? ''));
    await auth.serviceClient.from('jela_devices').update({ last_seen_at: new Date().toISOString() })
      .eq('owner_id', auth.user.id).eq('installation_id', String(body.installationId ?? '')).is('revoked_at', null);
    return jsonResponse(200, { updated: true });
  }

  if (action === 'devices') {
    const rows = await auth.serviceClient.from('jela_devices')
      .select('id,installation_id,platform,device_name,app_version,last_seen_at,revoked_at,created_at')
      .eq('owner_id', auth.user.id).order('last_seen_at', { ascending: false });
    if (rows.error) return jsonResponse(503, { code: 'devices_failed', message: 'Your devices could not be loaded.' });
    return jsonResponse(200, { devices: rows.data ?? [], currentInstallationId: String(body.installationId ?? '') });
  }

  if (action === 'revoke_device') {
    const targetInstallationId = String(body.targetInstallationId ?? '').slice(0, 100);
    if (targetInstallationId.length < 10) return jsonResponse(400, { code: 'invalid_device', message: 'That device is unavailable.' });
    const now = new Date().toISOString();
    await auth.serviceClient.from('jela_devices').update({ revoked_at: now }).eq('owner_id', auth.user.id)
      .eq('installation_id', targetInstallationId);
    await auth.serviceClient.from('jela_push_tokens').update({ enabled: false, disabled_reason: 'device_revoked', last_seen_at: now })
      .eq('user_id', auth.user.id).eq('installation_id', targetInstallationId);
    await auth.serviceClient.from('jela_security_events').insert({
      actor_id: auth.user.id, subject_id: auth.user.id, event_type: 'device.revoked', severity: 'info',
      metadata: { installation_id_hash: createHash('sha256').update(targetInstallationId).digest('hex') },
    });
    return jsonResponse(200, { revoked: true, currentDevice: targetInstallationId === String(body.installationId ?? '') });
  }

  if (action === 'history') {
    const rows = await auth.serviceClient.from('jela_notifications')
      .select('id,kind,title,body,data,status,created_at,jela_notification_reads(read_at)')
      .or(`audience.eq.all,target_user_id.eq.${auth.user.id}`)
      .order('created_at', { ascending: false }).limit(100);
    if (rows.error) return jsonResponse(503, { code: 'history_failed', message: 'Notifications could not be loaded.' });
    const notifications = (rows.data ?? []).map((row) => ({
      ...row,
      read: Array.isArray(row.jela_notification_reads) && row.jela_notification_reads.length > 0,
      jela_notification_reads: undefined,
    }));
    return jsonResponse(200, { notifications });
  }

  if (action === 'read') {
    const notificationId = String(body.notificationId ?? '');
    const visible = await auth.serviceClient.from('jela_notifications').select('id')
      .eq('id', notificationId).or(`audience.eq.all,target_user_id.eq.${auth.user.id}`).maybeSingle();
    if (!visible.data) return jsonResponse(404, { code: 'notification_not_found', message: 'Notification not found.' });
    await auth.serviceClient.from('jela_notification_reads').upsert({ notification_id: notificationId, user_id: auth.user.id });
    return jsonResponse(200, { read: true });
  }

  const installationId = String(body.installationId ?? '');
  const token = await auth.serviceClient.from('jela_push_tokens').select('enabled,permission_status')
    .eq('user_id', auth.user.id).eq('installation_id', installationId).maybeSingle();
  return jsonResponse(200, {
    enabled: Boolean(token.data?.enabled && token.data?.permission_status === 'granted'),
    permissionStatus: token.data?.permission_status ?? 'undetermined',
  });
});
