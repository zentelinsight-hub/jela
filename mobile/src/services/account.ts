import type { User } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';
import type { AccountStatus, AppRole, JelaAccount } from '@/types/database';
import { readCache, cachedRequest } from '@/lib/offline-cache';

export type AccountSnapshot = {
  profile: JelaAccount | null;
  roles: AppRole[];
};

export async function fetchAccount(user: User): Promise<AccountSnapshot> {
  return cachedRequest(`account.${user.id}`, async () => {
  const supabase = getSupabase();
  const [profileResult, rolesResult] = await Promise.all([
    supabase.from('jela_accounts').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('jela_account_roles').select('role').eq('user_id', user.id),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (rolesResult.error) throw rolesResult.error;

  return {
    profile: profileResult.data as JelaAccount | null,
    roles: (rolesResult.data ?? []).map((entry) => entry.role as AppRole),
  };
  });
}

export function fetchCachedAccount(userId: string) {
  return readCache<AccountSnapshot>(`account.${userId}`);
}

export async function updateProfile(input: {
  firstName: string;
  lastName: string;
  age: number;
  gender: 'male' | 'female' | 'prefer_not_to_say';
}) {
  const { data, error } = await getSupabase().rpc('update_jela_profile_v3', {
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_age: input.age,
    p_gender: input.gender,
  });
  if (error) throw error;
  return data as JelaAccount;
}

export function accountStatusMessage(status?: AccountStatus | null) {
  if (status === 'suspended') {
    return 'This account is suspended. Contact Jela AI support if you think this is a mistake.';
  }
  if (status === 'deactivated') {
    return 'This Jela AI account has been deactivated. Contact Jela AI support for assistance.';
  }
  return null;
}
