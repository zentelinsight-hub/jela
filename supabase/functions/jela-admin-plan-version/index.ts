import { adminUser, corsHeaders, jsonResponse, paystackRequest } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await adminUser(request);
  if (auth instanceof Response) return auth;

  let body: { plan_id?: unknown; price_minor?: unknown; reason?: unknown };
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_request', message: 'Enter a valid plan price.' }); }
  const planId = typeof body.plan_id === 'string' ? body.plan_id : '';
  const priceMinor = typeof body.price_minor === 'number' ? Math.round(body.price_minor) : 0;
  const reason = typeof body.reason === 'string' && body.reason.trim().length >= 3
    ? body.reason.trim()
    : 'Admin price update from Plan Configuration';
  if (!planId || priceMinor <= 0) return jsonResponse(400, { code: 'invalid_price', message: 'Enter a valid monthly price.' });

  const plan = await auth.serviceClient
    .from('jela_plans')
    .select('id,code,name,currency,interval,current_version_id,active')
    .eq('id', planId)
    .maybeSingle();
  if (plan.error || !plan.data?.active || plan.data.code === 'free' || plan.data.interval !== 'month') {
    return jsonResponse(404, { code: 'plan_unavailable', message: 'This paid monthly plan is unavailable.' });
  }
  const version = await auth.serviceClient
    .from('jela_plan_versions')
    .select('version_number,internal_allowance,feature_config,rate_limits')
    .eq('id', plan.data.current_version_id)
    .maybeSingle();
  if (version.error || !version.data?.internal_allowance) {
    return jsonResponse(409, { code: 'configuration_incomplete', message: 'Complete this plan configuration before changing its price.' });
  }

  try {
    const paystack = await paystackRequest('/plan', {
      method: 'POST',
      body: JSON.stringify({
        name: `Jela ${plan.data.name} monthly v${version.data.version_number + 1}`,
        amount: priceMinor,
        interval: 'monthly',
        currency: plan.data.currency,
        description: `Jela AI ${plan.data.name} monthly subscription`,
      }),
    });
    const providerPlanCode = (paystack.data as { plan_code?: string } | undefined)?.plan_code;
    if (!providerPlanCode) throw new Error('provider_plan_missing');

    const published = await auth.serviceClient.rpc('service_create_jela_plan_version', {
      p_actor_id: auth.user.id,
      p_plan_id: plan.data.id,
      p_price_minor: priceMinor,
      p_provider_plan_code: providerPlanCode,
      p_internal_allowance: version.data.internal_allowance,
      p_feature_config: version.data.feature_config,
      p_rate_limits: version.data.rate_limits,
      p_reason: reason,
    });
    if (published.error) throw published.error;
    return jsonResponse(200, { planVersionId: published.data, providerPlanConfigured: true });
  } catch {
    return jsonResponse(502, {
      code: 'plan_publish_failed',
      message: 'The new price could not be published. Existing pricing and subscriptions were not changed.',
    });
  }
});
