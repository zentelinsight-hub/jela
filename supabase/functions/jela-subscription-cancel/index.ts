import { corsHeaders, jsonResponse, paystackRequest, verifiedUser } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await verifiedUser(request);
  if (auth instanceof Response) return auth;
  const subscription = await auth.serviceClient.from('jela_subscriptions')
    .select('id,provider_subscription_id,provider_email_token,status,current_period_end,cancel_at_period_end')
    .eq('user_id', auth.user.id).in('status', ['active', 'trialing', 'past_due', 'grace_period'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (subscription.error || !subscription.data) {
    return jsonResponse(404, { code: 'subscription_not_found', message: 'No active subscription was found.' });
  }
  if (subscription.data.cancel_at_period_end) {
    return jsonResponse(200, { cancelled: true, currentPeriodEnd: subscription.data.current_period_end, replay: true });
  }
  if (!subscription.data.provider_subscription_id || !subscription.data.provider_email_token) {
    return jsonResponse(409, { code: 'cancellation_unavailable', message: 'This subscription cannot be cancelled automatically. Contact support.' });
  }
  try {
    await paystackRequest('/subscription/disable', {
      method: 'POST',
      body: JSON.stringify({
        code: subscription.data.provider_subscription_id,
        token: subscription.data.provider_email_token,
      }),
    });
  } catch {
    return jsonResponse(502, { code: 'cancellation_failed', message: 'The subscription could not be cancelled right now. Nothing was changed.' });
  }
  const now = new Date().toISOString();
  await auth.serviceClient.from('jela_subscriptions').update({
    cancel_at_period_end: true,
    cancellation_requested_at: now,
    provider_status_reason: 'user_requested',
    updated_at: now,
  }).eq('id', subscription.data.id);
  await auth.serviceClient.from('jela_audit_logs').insert({
    actor_id: auth.user.id, action: 'subscription.cancellation_requested', target_type: 'subscription',
    target_id: subscription.data.id, metadata: { current_period_end: subscription.data.current_period_end },
  });
  return jsonResponse(200, { cancelled: true, currentPeriodEnd: subscription.data.current_period_end, replay: false });
});
