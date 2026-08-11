import { authenticatedUser, corsHeaders, jsonResponse, paystackRequest } from '../_shared/http.ts';

const referencePattern = /^jela-[0-9a-f-]{36}$/i;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await authenticatedUser(request);
  if (auth instanceof Response) return auth;

  let body: { reference?: unknown };
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_reference', message: 'The payment reference is invalid.' }); }
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!referencePattern.test(reference)) return jsonResponse(400, { code: 'invalid_reference', message: 'The payment reference is invalid.' });

  const attempt = await auth.serviceClient.from('jela_payment_attempts')
    .select('id,user_id,status,fulfilled_at').eq('reference', reference).eq('user_id', auth.user.id).maybeSingle();
  if (attempt.error || !attempt.data) return jsonResponse(404, { code: 'payment_not_found', message: 'This payment could not be found.' });
  if (attempt.data.fulfilled_at) return jsonResponse(200, { status: 'successful', fulfilled: true, idempotent: true });

  try {
    const payload = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const data = payload.data as {
      id?: number; status?: string; reference?: string; amount?: number; currency?: string;
      channel?: string; paid_at?: string; receipt_number?: string | null;
      customer?: { email?: string; customer_code?: string };
      plan?: { plan_code?: string } | null;
      gateway_response?: string; fees?: number;
    };
    if (!data || data.reference !== reference || !data.status || !data.customer?.email) throw new Error('invalid_provider_response');
    const settled = await auth.serviceClient.rpc('settle_jela_paystack_payment', {
      p_reference: reference,
      p_provider_transaction_id: String(data.id ?? reference),
      p_provider_status: data.status,
      p_amount_minor: data.amount ?? 0,
      p_currency: data.currency ?? '',
      p_channel: data.channel ?? '',
      p_paid_at: data.paid_at ?? null,
      p_customer_email: data.customer.email,
      p_provider_subscription_id: null,
      p_provider_customer_code: data.customer.customer_code ?? null,
      p_provider_email_token: null,
      p_receipt_number: data.receipt_number ?? null,
      p_provider_payload: { gateway_response: data.gateway_response ?? null, fees: data.fees ?? null },
    });
    if (settled.error) throw settled.error;
    return jsonResponse(200, settled.data as Record<string, unknown>);
  } catch {
    return jsonResponse(502, {
      code: 'payment_confirmation_unavailable',
      message: "Your payment is still being confirmed. We'll update your account when verification completes.",
      status: 'processing',
      fulfilled: false,
    });
  }
});

