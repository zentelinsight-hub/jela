import { getSupabase } from '@/lib/supabase';
import type { UsageState } from '@/types/database';

export async function fetchUsageState(): Promise<UsageState> {
  const { data, error } = await getSupabase().rpc('get_my_jela_usage_state');
  if (error) throw error;
  return data as UsageState;
}
