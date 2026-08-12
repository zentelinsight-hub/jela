import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { TextField } from '@/components/text-field';
import { friendlyError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { getSupabase } from '@/lib/supabase';

type AdminPlan = { id: string; code: string; name: string; price_minor: number; currency: string; most_popular: boolean; current_version_id: string };

export default function Screen() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await getSupabase().from('jela_plans').select('id,code,name,price_minor,currency,most_popular,current_version_id').order('sort_order');
    if (loadError) setError(friendlyError(loadError, 'Could not load plan configuration.'));
    else { const rows = (data ?? []) as AdminPlan[]; setPlans(rows); setPrices(Object.fromEntries(rows.map((p) => [p.id, String(p.price_minor / 100)]))); setError(null); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const save = async (plan: AdminPlan) => {
    const amount = Number(prices[plan.id]);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid monthly price.'); return; }
    setSaving(plan.id); setError(null);
    const updated = await getSupabase().functions.invoke('jela-admin-plan-version', {
      body: {
        plan_id: plan.id,
        price_minor: Math.round(amount * 100),
        reason: 'Admin price update from Plan Configuration',
      },
    });
    if (updated.error) setError(friendlyError(updated.error, 'Could not publish the new Paystack-backed plan version.'));
    else await load();
    setSaving(null);
  };
  return <PageScreen title="Plan Configuration" subtitle="Version-safe pricing for new purchases">{loading ? <LoadingState /> : error && !plans.length ? <ErrorState message={error} onRetry={() => void load()} /> : <View style={{ gap: 14 }}>{error ? <AppText tone="danger">{error}</AppText> : null}{plans.map((plan) => <SectionCard key={plan.id} title={plan.name}><AppText tone="muted">Current public price: {formatMoney(plan.price_minor, plan.currency)} / month{plan.most_popular ? ' · Most Popular' : ''}</AppText>{plan.code === 'free' ? <AppText tone="muted">Free plan pricing is fixed at ₦0. Hidden usage remains server-controlled.</AppText> : <><TextField label="New monthly price (NGN)" value={prices[plan.id] ?? ''} onChangeText={(value) => setPrices((all) => ({ ...all, [plan.id]: value }))} keyboardType="numeric" /><Button loading={saving === plan.id} onPress={() => void save(plan)}>Publish new price version</Button></>}</SectionCard>)}</View>}</PageScreen>;
}
