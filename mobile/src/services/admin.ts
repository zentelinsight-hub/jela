import { getSupabase } from '@/lib/supabase';
import type { AdminOverview } from '@/types/database';

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

export async function suspendAccount(userId: string, reason: string) {
  const { error } = await getSupabase().rpc('admin_set_jela_account_status', {
    p_user_id: userId,
    p_status: 'suspended',
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function restoreAccount(userId: string) {
  const { error } = await getSupabase().rpc('admin_set_jela_account_status', {
    p_user_id: userId,
    p_status: 'active',
    p_reason: null,
  });
  if (error) throw error;
}
