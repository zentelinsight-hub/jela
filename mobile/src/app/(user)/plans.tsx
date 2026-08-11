import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { formatMoney } from '@/lib/format';
import { friendlyError } from '@/lib/errors';
import { fetchPlans, initializePlanPayment, verifyPlanPayment } from '@/services/commerce';
import type { Plan } from '@/types/database';
import { getSupabase } from '@/lib/supabase';

export default function PlansScreen() {
  const { colors } = useAppTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try { setPlans(await fetchPlans()); setError(null); }
    catch (loadError) { setError(friendlyError(loadError, 'Could not load plans.')); }
    finally { if (showLoading) setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase.channel('public-plans-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_plans' }, () => void load(false))
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void load(false); });
    return () => { appState.remove(); void supabase.removeChannel(channel); };
  }, []);
  const pay = async (plan: Plan) => {
    setProcessingPlan(plan.code); setError(null); setNotice(null);
    try {
      const initialized = await initializePlanPayment(plan.code);
      const callback = Linking.createURL('payment-return');
      const result = await WebBrowser.openAuthSessionAsync(initialized.authorizationUrl, callback);
      if (result.type !== 'success') { setNotice('Payment was not completed. No plan change was made.'); return; }
      const reference = new URL(result.url).searchParams.get('reference') ?? initialized.reference;
      const verified = await verifyPlanPayment(reference);
      setNotice(verified.fulfilled ? 'Payment confirmed. Your plan is active.' : 'Payment is being confirmed securely.');
    } catch (caught) { setError(friendlyError(caught, 'Secure payment is not available for this plan yet. No charge was made.')); }
    finally { setProcessingPlan(null); }
  };
  return (
    <PageScreen title="Plans" subtitle="Live plans from Jela AI">
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !plans.length ? (
        <EmptyState title="Plans are not configured" message="No public plan or price has been published by Jela AI yet. Nothing will be charged from this screen." />
      ) : (
        <View style={{ gap: 14 }}>
          {notice ? <AppText tone="success">{notice}</AppText> : null}
          {plans.map((plan) => (
            <SectionCard key={plan.id} title={plan.name}>
              <AppText variant="headline">{formatMoney(plan.price_minor, plan.currency)}<AppText tone="muted"> / {plan.interval.replace('_', ' ')}</AppText></AppText>
              {plan.description ? <AppText tone="muted">{plan.description}</AppText> : null}
              {plan.features.map((feature) => <View key={feature} style={{ flexDirection: 'row', gap: 8 }}><Check color={colors.primary} size={18} /><AppText style={{ flex: 1 }}>{feature}</AppText></View>)}
              {plan.code === 'free' ? <AppText tone="muted" variant="caption">Included when you create an account.</AppText> : plan.purchasable ? (
                <Button loading={processingPlan === plan.code} onPress={() => void pay(plan)}>Continue to secure Paystack checkout</Button>
              ) : <AppText tone="muted" variant="caption">Secure checkout for this plan is being prepared. No payment can be taken yet.</AppText>}
            </SectionCard>
          ))}
        </View>
      )}
    </PageScreen>
  );
}
