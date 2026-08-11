import { getSupabase } from '@/lib/supabase';
import type { FeatureFlags } from '@/types/database';

const safeDefaults: FeatureFlags = {
  chat_enabled: false,
  attachments_enabled: false,
  voice_enabled: false,
  push_notifications_enabled: false,
  maintenance_mode: false,
};

export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const { data, error } = await getSupabase()
    .from('jela_app_config')
    .select('key,value')
    .in('key', Object.keys(safeDefaults));

  if (error) throw error;
  const values = Object.fromEntries(
    (data ?? []).map((entry) => [entry.key, entry.value === true]),
  );
  return { ...safeDefaults, ...values };
}
