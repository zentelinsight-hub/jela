import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { TextField } from '@/components/text-field';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { getSupabase } from '@/lib/supabase';
import { updateWorkspacePlan } from '@/services/admin';

type AdminPlan = {
  id: string; code: string; name: string; price_minor: number; currency: string;
  most_popular: boolean; current_version_id: string;
  jela_plan_versions?: { feature_config?: Record<string, boolean>; rate_limits?: Record<string, number> } | null;
};
const featureKeys = ['memory_enabled', 'auto_memory_enabled', 'projects_enabled', 'workspace_files_enabled', 'file_analysis_enabled', 'image_generation_enabled', 'research', 'deep_think', 'voice_enabled'] as const;
const limitKeys = ['memory_item_limit', 'storage_bytes_limit', 'max_projects', 'image_generation_limit', 'web_search_limit', 'max_file_size', 'max_project_files'] as const;

export default function Screen() {
  const { colors } = useAppTheme();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState<Record<string, Record<string, boolean>>>({});
  const [limits, setLimits] = useState<Record<string, Record<string, string>>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    const result = await getSupabase().from('jela_plans')
      .select('id,code,name,price_minor,currency,most_popular,current_version_id,jela_plan_versions!jela_plans_current_version_fk(feature_config,rate_limits)')
      .order('sort_order');
    if (result.error) setError(friendlyError(result.error, 'Could not load plan configuration.'));
    else {
      const rows = (result.data ?? []) as unknown as AdminPlan[];
      setPlans(rows);
      setPrices(Object.fromEntries(rows.map((plan) => [plan.id, String(plan.price_minor / 100)])));
      setFeatures(Object.fromEntries(rows.map((plan) => [plan.id, plan.jela_plan_versions?.feature_config ?? {}])));
      setLimits(Object.fromEntries(rows.map((plan) => [plan.id, Object.fromEntries(Object.entries(plan.jela_plan_versions?.rate_limits ?? {}).map(([key, value]) => [key, String(value)]))])));
      setError(null);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const savePrice = async (plan: AdminPlan) => {
    const amount = Number(prices[plan.id]);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid monthly price.'); return; }
    setSaving(plan.id); setError(null);
    const updated = await getSupabase().functions.invoke('jela-admin-plan-version', {
      body: { plan_id: plan.id, price_minor: Math.round(amount * 100), reason: 'Admin price update from Plans & Entitlements' },
    });
    if (updated.error) setError(friendlyError(updated.error, 'Could not publish the new Paystack-backed plan version.'));
    else await load();
    setSaving(null);
  };
  const saveEntitlements = async (plan: AdminPlan) => {
    const reason = reasons[plan.id]?.trim() ?? '';
    if (reason.length < 3) { setError('Enter a clear audit reason before publishing entitlement changes.'); return; }
    const parsed = Object.fromEntries(limitKeys.map((key) => [key, Number(limits[plan.id]?.[key])])) as Record<string, number>;
    if (Object.values(parsed).some((value) => !Number.isFinite(value) || value < 0)) { setError('All entitlement limits must be valid non-negative numbers.'); return; }
    setSaving(`entitlements-${plan.id}`); setError(null);
    try { await updateWorkspacePlan(plan.id, features[plan.id] ?? {}, parsed, reason); await load(); }
    catch (caught) { setError(friendlyError(caught, 'Could not publish the workspace entitlement policy.')); }
    finally { setSaving(null); }
  };
  return <PageScreen title="Plans & Entitlements" subtitle="Audited server-side product policy">
    {loading ? <LoadingState /> : error && !plans.length ? <ErrorState message={error} onRetry={() => void load()} /> : <View style={{ gap: 14 }}>
      {error ? <AppText tone="danger">{error}</AppText> : null}
      {plans.map((plan) => <SectionCard key={plan.id} title={plan.name}>
        <AppText tone="muted">Current public price: {formatMoney(plan.price_minor, plan.currency)} / month{plan.most_popular ? ' · Most Popular' : ''}</AppText>
        {plan.code === 'free' ? <AppText tone="muted">Free pricing is fixed at ₦0. Workspace policy remains editable below.</AppText> : <><TextField label="New monthly price (NGN)" value={prices[plan.id] ?? ''} onChangeText={(value) => setPrices((all) => ({ ...all, [plan.id]: value }))} keyboardType="numeric" /><Button loading={saving === plan.id} onPress={() => void savePrice(plan)}>Publish new price version</Button></>}
        <AppText variant="title">Workspace capabilities</AppText>
        {featureKeys.map((key) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><AppText style={{ flex: 1 }}>{key.replaceAll('_', ' ')}</AppText><Switch accessibilityLabel={`${plan.name} ${key.replaceAll('_', ' ')}`} value={features[plan.id]?.[key] === true} trackColor={{ true: colors.primary }} onValueChange={(value) => setFeatures((all) => ({ ...all, [plan.id]: { ...(all[plan.id] ?? {}), [key]: value } }))} /></View>)}
        <AppText variant="title">Workspace limits</AppText>
        {limitKeys.map((key) => <TextField key={key} label={key.replaceAll('_', ' ')} value={limits[plan.id]?.[key] ?? ''} onChangeText={(value) => setLimits((all) => ({ ...all, [plan.id]: { ...(all[plan.id] ?? {}), [key]: value } }))} keyboardType="numeric" />)}
        <TextField label="Audit reason" value={reasons[plan.id] ?? ''} onChangeText={(value) => setReasons((all) => ({ ...all, [plan.id]: value }))} hint="Required and recorded in the Audit Log." />
        <Button loading={saving === `entitlements-${plan.id}`} onPress={() => void saveEntitlements(plan)}>Publish entitlement policy</Button>
      </SectionCard>)}
    </View>}
  </PageScreen>;
}
