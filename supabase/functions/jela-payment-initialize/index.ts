import { authenticatedUser, corsHeaders, jsonResponse, paystackRequest } from '../_shared/http.ts';

const codePattern = /^[a-z][a-z0-9_-]{1,30}$/;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await authenticatedUser(request);
  if (auth instanceof Response) return auth;

  let body: { plan_code?: unknown };
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_request', message: 'Choose a valid Jela plan.' }); }
  const planCode = typeof body.plan_code === 'string' ? body.plan_code.trim().toLowerCase() : '';
  if (!codePattern.test(planCode) || planCode === 'free') {
    return jsonResponse(400, { code: 'invalid_plan', message: 'Choose a valid paid Jela plan.' });
  }

  const planResult = await auth.serviceClient
    .from('jela_plans')
    .select('id,code,name,currency,price_minor,interval,current_version_id,active')
    .eq('code', planCode)
    .maybeSingle();
  if (planResult.error || !planResult.data?.active || !planResult.data.current_version_id) {
    return jsonResponse(404, { code: 'plan_unavailable', message: 'This plan is not available right now.' });
  }
  const versionResult = await auth.serviceClient
    .from('jela_plan_versions')
    .select('id,price_minor,currency,purchasable,active,internal_allowance,provider_plan_code')
    .eq('id', planResult.data.current_version_id)
    .maybeSingle();
  const version = versionResult.data;
  if (versionResult.error || !version?.active || !version.purchasable || !version.internal_allowance) {
    return jsonResponse(409, {
      code: 'payment_not_ready',
      message: 'Secure payment is not available for this plan yet. No charge was made.',
    });
  }
  if (!auth.user.email) {
    return jsonResponse(409, { code: 'verified_email_required', message: 'A verified account email is required for billing.' });
  }

  const reference = `jela-${crypto.randomUUID()}`;
  const attempt = await auth.serviceClient.from('jela_payment_attempts').insert({
    user_id: auth.user.id,
    plan_id: planResult.data.id,
    plan_version_id: version.id,
    reference,
    amount_minor: version.price_minor,
    currency: version.currency,
    metadata: { plan_code: planCode },
  }).select('id').single();
  if (attempt.error) {
    return jsonResponse(500, { code: 'payment_initialization_failed', message: 'Unable to start payment. No charge was made.' });
  }

  const websiteUrl = (Deno.env.get('JELA_WEBSITE_URL') ?? 'https://jela-ai-official.victorudofiah25.chatgpt.site').replace(/\/$/, '');
  try {
    const payload = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: auth.user.email,
        amount: String(version.price_minor),
        currency: version.currency,
        reference,
        callback_url: `${websiteUrl}/payment-return`,
        ...(version.provider_plan_code ? { plan: version.provider_plan_code } : {}),
        metadata: {
          jela_user_id: auth.user.id,
          jela_plan_id: planResult.data.id,
          jela_plan_version_id: version.id,
          jela_reference: reference,
        },
      }),
    });
    const data = payload.data as { access_code?: string; authorization_url?: string; reference?: string };
    if (!data?.access_code || !data.authorization_url || data.reference !== reference) throw new Error('invalid_provider_response');
    await auth.serviceClient.from('jela_payment_attempts').update({
      access_code: data.access_code,
      authorization_url: data.authorization_url,
      status: 'processing',
      updated_at: new Date().toISOString(),
    }).eq('id', attempt.data.id);
    return jsonResponse(200, {
      reference,
      accessCode: data.access_code,
      authorizationUrl: data.authorization_url,
      planName: planResult.data.name,
    });
  } catch {
    await auth.serviceClient.from('jela_payment_attempts').update({
      status: 'failed', failure_reason: 'provider_initialization_failed', updated_at: new Date().toISOString(),
    }).eq('id', attempt.data.id);
    return jsonResponse(502, { code: 'payment_initialization_failed', message: 'Unable to start payment. No charge was made.' });
  }
});

