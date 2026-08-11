import { getSupabase } from '@/lib/supabase';
import type { Plan, Subscription } from '@/types/database';

export async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await getSupabase()
    .from('jela_plans')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function fetchSubscription(): Promise<Subscription | null> {
  const { data, error } = await getSupabase()
    .from('jela_subscriptions')
    .select('id,plan_id,status,current_period_end,cancel_at_period_end,jela_plans(name,code)')
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Subscription | null;
}

export async function fetchBillingRecords() {
  const { data, error } = await getSupabase()
    .from('jela_billing_records')
    .select('id,amount_minor,currency,status,description,created_at,receipt_url')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
