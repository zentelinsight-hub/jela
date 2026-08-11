import { getSupabase } from '@/lib/supabase';
import type { AccountStatus, AdminOverview } from '@/types/database';

async function count(table: string, equality?: readonly [string, string]) {
  let request = getSupabase().from(table).select('*', { count: 'exact', head: true });
  if (equality) request = request.eq(equality[0], equality[1]);
  const { count: total, error } = await request;
  if (error) throw error;
  return total ?? 0;
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const [accounts, conversations, messages, activeSubscriptions, failedRequests] =
    await Promise.all([
      count('jela_accounts'),
      count('jela_conversations'),
      count('jela_messages'),
      count('jela_subscriptions', ['status', 'active']),
      count('jela_ai_usage', ['status', 'failed']),
    ]);
  return { accounts, conversations, messages, activeSubscriptions, failedRequests };
}

export async function fetchAdminRows(table: string, columns = '*') {
  const { data, error } = await getSupabase()
    .from(table)
    .select(columns)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown[];
}

export async function setAccountStatus(userId: string, status: AccountStatus, reason?: string | null) {
  const { error } = await getSupabase().rpc('admin_set_jela_account_status', {
    p_user_id: userId,
    p_status: status,
    p_reason: reason?.trim() || null,
  });
  if (error) throw error;
}

export const suspendAccount = (userId: string, reason: string) => setAccountStatus(userId, 'suspended', reason);
export const restoreAccount = (userId: string) => setAccountStatus(userId, 'active');

export async function updateAdminConfig(key: string, value: unknown) {
  const { error } = await getSupabase().rpc('admin_update_jela_app_config', {
    p_key: key,
    p_value: value,
    p_reason: 'Updated from the native Jela Admin console',
  });
  if (error) throw error;
}

export async function fetchProviderHealth() {
  const { data, error } = await getSupabase().functions.invoke('jela-admin-health', { body: {} });
  if (error) throw error;
  return data as { openai: 'configured' | 'unavailable'; paystack: 'configured' | 'unavailable' };
}

export async function setUserAiOverride(userId: string, usePlanDefaults: boolean, overrideConfig: Record<string, unknown>) {
  const { error } = await getSupabase().rpc('admin_set_jela_user_override', {
    p_user_id: userId,
    p_use_plan_defaults: usePlanDefaults,
    p_override_config: overrideConfig,
    p_reason: 'Updated from the native Jela Admin account screen',
  });
  if (error) throw error;
}
