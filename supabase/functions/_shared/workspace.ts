import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type WorkspaceEntitlements = {
  plan_code: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  meter_period: { start: string; end: string };
};

export async function resolveEntitlements(client: SupabaseClient, userId: string) {
  const result = await client.rpc('resolve_jela_entitlements', { p_user_id: userId });
  if (result.error || !result.data) throw new Error('entitlements_unavailable');
  return result.data as WorkspaceEntitlements;
}

export function requireFeature(entitlements: WorkspaceEntitlements, key: string) {
  if (entitlements.features[key] !== true) throw new Error(`${key}_unavailable`);
}

export function entitlementLimit(entitlements: WorkspaceEntitlements, key: string, fallback = 0) {
  const value = Number(entitlements.limits[key]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export async function sha256(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('');
}

export async function createEmbedding(text: string) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('embedding_not_configured');
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text, dimensions: 1536 }),
  });
  const payload = await response.json() as { data?: Array<{ embedding?: number[] }>; error?: { code?: string } };
  const embedding = payload.data?.[0]?.embedding;
  if (!response.ok || !embedding) throw new Error(payload.error?.code ?? 'embedding_failed');
  return embedding;
}

export async function createEmbeddings(input: string[]) {
  if (input.length === 0) return [];
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('embedding_not_configured');
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input, dimensions: 1536 }),
  });
  const payload = await response.json() as { data?: Array<{ index: number; embedding?: number[] }>; error?: { code?: string } };
  if (!response.ok || !payload.data || payload.data.some((item) => !item.embedding)) {
    throw new Error(payload.error?.code ?? 'embedding_failed');
  }
  return payload.data.sort((a, b) => a.index - b.index).map((item) => item.embedding!);
}

export function vectorLiteral(values: number[]) {
  return `[${values.join(',')}]`;
}

export async function reserveMeter(
  client: SupabaseClient,
  userId: string,
  key: string,
  amount: number,
  limit: number,
  persistent = false,
  meterPeriod?: { start: string; end: string },
  rolling24Hours = false,
) {
  const window = persistent
    ? { start: '2000-01-01T00:00:00.000Z', end: '2100-01-01T00:00:00.000Z' }
    : meterPeriod;
  if (!window?.start || !window.end) throw new Error('meter_period_unavailable');
  const result = await client.rpc(rolling24Hours ? 'reserve_jela_meter_window' : 'reserve_jela_meter', {
    p_user_id: userId,
    p_meter_key: key,
    p_amount: amount,
    p_limit: limit,
    p_period_start: window.start,
    p_period_end: window.end,
    ...(rolling24Hours ? { p_rolling: true } : {}),
  });
  if (result.error) throw result.error;
  const data = result.data as { allowed?: boolean; meter_id?: string };
  if (!data.allowed || !data.meter_id) throw new Error(`${key}_limit_reached`);
  return data.meter_id;
}

export async function settleMeter(client: SupabaseClient, meterId: string, reserved: number, used: number) {
  const result = await client.rpc('settle_jela_meter', {
    p_meter_id: meterId,
    p_reserved: reserved,
    p_used: used,
  });
  if (result.error) throw result.error;
}
