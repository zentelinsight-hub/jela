import { jsonResponse, paystackRequest, serverClients } from '../_shared/http.ts';

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function hmacSha512(secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
}

async function fingerprint(value: string) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed' });
  const secret = Deno.env.get('PAYSTACK_API_KEY');
  if (!secret) return jsonResponse(503, { code: 'payment_backend_unavailable' });
  const rawBody = await request.text();
  const suppliedSignature = request.headers.get('x-paystack-signature') ?? '';
  const expectedSignature = await hmacSha512(secret, rawBody);
  if (!constantTimeEqual(expectedSignature, suppliedSignature.toLowerCase())) {
    return jsonResponse(401, { code: 'invalid_signature' });
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try { event = JSON.parse(rawBody); }
  catch { return jsonResponse(400, { code: 'invalid_payload' }); }
  const eventType = typeof event.event === 'string' ? event.event : 'unknown';
  const data = event.data ?? {};
  const reference = typeof data.reference === 'string' ? data.reference : null;
  const eventFingerprint = await fingerprint(`${suppliedSignature}:${rawBody}`);
  const { serviceClient } = serverClients();
  const recorded = await serviceClient.from('jela_payment_events').insert({
    event_fingerprint: eventFingerprint,
    event_type: eventType,
    reference,
    signature_valid: true,
    payload: event,
  }).select('id').single();
  if (recorded.error?.code === '23505') return jsonResponse(200, { received: true, idempotent: true });
  if (recorded.error) return jsonResponse(500, { code: 'event_record_failed' });

  try {
    if (eventType === 'charge.success' && reference) {
      const verifiedPayload = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
      const verified = verifiedPayload.data as {
        id?: number; status?: string; reference?: string; amount?: number; currency?: string;
        channel?: string; paid_at?: string; receipt_number?: string | null;
        customer?: { email?: string; customer_code?: string };
        gateway_response?: string; fees?: number;
      };
      if (verified.reference !== reference || !verified.customer?.email) throw new Error('invalid_provider_response');
      const settled = await serviceClient.rpc('settle_jela_paystack_payment', {
        p_reference: reference,
        p_provider_transaction_id: String(verified.id ?? reference),
        p_provider_status: verified.status ?? '',
        p_amount_minor: verified.amount ?? 0,
        p_currency: verified.currency ?? '',
        p_channel: verified.channel ?? '',
        p_paid_at: verified.paid_at ?? null,
        p_customer_email: verified.customer.email,
        p_provider_subscription_id: null,
        p_provider_customer_code: verified.customer.customer_code ?? null,
        p_provider_email_token: null,
        p_receipt_number: verified.receipt_number ?? null,
        p_provider_payload: { gateway_response: verified.gateway_response ?? null, fees: verified.fees ?? null },
      });
      if (settled.error) throw settled.error;
    } else {
      const subscription = data.subscription as { subscription_code?: string; email_token?: string } | undefined;
      const subscriptionCode = typeof data.subscription_code === 'string'
        ? data.subscription_code
        : subscription?.subscription_code;
      if (subscriptionCode) {
        if (eventType === 'subscription.not_renew') {
          await serviceClient.from('jela_subscriptions').update({
            cancel_at_period_end: true,
            cancellation_requested_at: new Date().toISOString(),
            provider_status_reason: 'provider_not_renewing',
            updated_at: new Date().toISOString(),
          })
            .eq('provider_subscription_id', subscriptionCode);
        } else if (eventType === 'subscription.disable') {
          await serviceClient.from('jela_subscriptions').update({
            status: 'cancelled', cancel_at_period_end: true,
            cancelled_at: new Date().toISOString(),
            provider_status_reason: 'provider_disabled',
            updated_at: new Date().toISOString(),
          })
            .eq('provider_subscription_id', subscriptionCode);
        } else if (eventType === 'invoice.payment_failed') {
          const stored = await serviceClient.from('jela_subscriptions')
            .select('provider_email_token').eq('provider_subscription_id', subscriptionCode).maybeSingle();
          const emailToken = subscription?.email_token ?? stored.data?.provider_email_token;
          if (emailToken) {
            try {
              await paystackRequest('/subscription/disable', {
                method: 'POST', body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
              });
            } catch { /* The local downgrade remains authoritative and idempotent. */ }
          }
          await serviceClient.from('jela_subscriptions').update({
            status: 'expired', cancel_at_period_end: true,
            cancellation_requested_at: new Date().toISOString(),
            cancelled_at: new Date().toISOString(),
            provider_status_reason: 'renewal_payment_failed',
            updated_at: new Date().toISOString(),
          })
            .eq('provider_subscription_id', subscriptionCode);
        }
      }
    }
    await serviceClient.from('jela_payment_events').update({ processed_at: new Date().toISOString() }).eq('id', recorded.data.id);
  } catch {
    await serviceClient.from('jela_payment_events').update({
      processed_at: new Date().toISOString(), processing_error: 'processing_failed',
    }).eq('id', recorded.data.id);
  }
  return jsonResponse(200, { received: true });
});
