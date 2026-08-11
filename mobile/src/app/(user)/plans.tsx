import * as Linking from 'expo-linking';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { formatMoney } from '@/lib/format';
import { fetchPlans } from '@/services/commerce';
import type { Plan } from '@/types/database';

export default function PlansScreen() {
  const { colors } = useAppTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try { setPlans(await fetchPlans()); setError(null); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load plans.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return (
    <PageScreen title="Plans" subtitle="Live plans from Jela AI">
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !plans.length ? (
        <EmptyState title="Plans are not configured" message="No public plan or price has been published by Jela AI yet. Nothing will be charged from this screen." />
      ) : (
        <View style={{ gap: 14 }}>
          {plans.map((plan) => (
            <SectionCard key={plan.id} title={plan.name}>
              <AppText variant="headline">{formatMoney(plan.price_minor, plan.currency)}<AppText tone="muted"> / {plan.interval.replace('_', ' ')}</AppText></AppText>
              {plan.description ? <AppText tone="muted">{plan.description}</AppText> : null}
              <AppText variant="label">{plan.credits} credits</AppText>
              {plan.features.map((feature) => <View key={feature} style={{ flexDirection: 'row', gap: 8 }}><Check color={colors.primary} size={18} /><AppText style={{ flex: 1 }}>{feature}</AppText></View>)}
              {plan.checkout_url ? <Button onPress={() => Linking.openURL(plan.checkout_url!)}>Continue to secure checkout</Button> : <AppText tone="muted" variant="caption">Checkout is not enabled for this plan.</AppText>}
            </SectionCard>
          ))}
        </View>
      )}
    </PageScreen>
  );
}
