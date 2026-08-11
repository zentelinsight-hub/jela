import { getSupabase } from '@/lib/supabase';
import type { CreditWallet } from '@/types/database';

export async function fetchCreditWallet(): Promise<CreditWallet | null> {
  const { data, error } = await getSupabase()
    .from('jela_credit_wallets')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as CreditWallet | null;
}

export async function fetchCreditLedger() {
  const { data, error } = await getSupabase()
    .from('jela_credit_ledger')
    .select('id,amount,kind,description,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
