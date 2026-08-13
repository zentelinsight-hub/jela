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

export type AdminAccountRow = {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  display_name: string | null;
  username: string | null;
  age: number | null;
  status: string;
  status_reason: string | null;
  profile_completed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  plan_name: string | null;
  subscription_status: string | null;
};

export async function fetchAdminAccounts(query = '', limit = 30, offset = 0) {
  const { data, error } = await getSupabase().rpc('admin_list_jela_accounts', {
    p_query: query.trim(), p_limit: limit, p_offset: offset,
  });
  if (error) throw error;
  const result = data as { total?: number; rows?: AdminAccountRow[] } | null;
  return { total: result?.total ?? 0, rows: result?.rows ?? [] };
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
  return data as Record<string, 'healthy' | 'configured' | 'managed' | 'degraded' | 'unavailable'>;
}

export type AdminWorkspaceMetrics = {
  active_projects: number; stored_files: number; storage_bytes: number; active_memories: number;
  generated_images: number; web_searches: number;
  jobs: { queued: number; processing: number; failed: number };
  embeddings: { memory_ready: number; memory_failed: number; file_ready: number; file_failed: number };
};

export async function fetchAdminWorkspaceMetrics() {
  const { data, error } = await getSupabase().rpc('admin_jela_workspace_metrics');
  if (error) throw error;
  return data as AdminWorkspaceMetrics;
}

export async function updateWorkspacePlan(
  planId: string, featureConfig: Record<string, boolean>, rateLimits: Record<string, number>, reason: string,
) {
  const { error } = await getSupabase().rpc('admin_update_jela_workspace_plan', {
    p_plan_id: planId, p_feature_config: featureConfig, p_rate_limits: rateLimits, p_reason: reason,
  });
  if (error) throw error;
}

export async function fetchAccountWorkspaceState(userId: string) {
  const { data, error } = await getSupabase().rpc('admin_jela_account_workspace_state', { p_user_id: userId });
  if (error) throw error;
  return data as {
    entitlements: { plan_code: string; features: Record<string, boolean>; limits: Record<string, number> };
    override: { use_plan_defaults: boolean; override_config: Record<string, unknown> } | null;
    workspace: { projects: number; memories: number; files: number; storage_bytes: number; images: number };
  };
}

export async function setUserAiOverride(
  userId: string, usePlanDefaults: boolean, overrideConfig: Record<string, unknown>,
  reason = 'Updated from the native Jela Admin account screen',
) {
  const { error } = await getSupabase().rpc('admin_set_jela_user_override', {
    p_user_id: userId,
    p_use_plan_defaults: usePlanDefaults,
    p_override_config: overrideConfig,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function broadcastNotification(title: string, body: string) {
  const result = await getSupabase().functions.invoke<{
    notificationId: string;
    recipientCount: number;
    accepted: number;
    failed: number;
  }>('jela-admin-notification', { body: { title, body } });
  if (result.error) {
    const message = result.data && typeof result.data === 'object' && 'message' in result.data
      ? String(result.data.message) : result.error.message;
    throw new Error(message);
  }
  if (!result.data) throw new Error('The broadcast returned no delivery result.');
  return result.data;
}
