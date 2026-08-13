import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Alert, AppState, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { formatDate, formatMoney } from '@/lib/format';
import { friendlyError } from '@/lib/errors';
import { fetchBillingRecords, fetchSubscription } from '@/services/commerce';
import type { Subscription } from '@/types/database';
import { useAuth } from '@/contexts/auth-context';
import { getSupabase } from '@/lib/supabase';
import { cancelSubscription } from '@/services/security';

type BillingRow = { id: string; amount_minor: number; currency: string; status: string; description: string | null; created_at: string; receipt_url: string | null };

export default function BillingScreen() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [records, setRecords] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [nextSubscription, nextRecords] = await Promise.all([fetchSubscription(), fetchBillingRecords()]);
      setSubscription(nextSubscription); setRecords(nextRecords as BillingRow[]); setError(null);
    } catch (loadError) { setError(friendlyError(loadError, 'Could not load billing.')); }
    finally { if (showLoading) setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    const refresh = () => void load(false);
    const channel = supabase.channel(`billing-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_subscriptions', filter: `user_id=eq.${user.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_billing_records', filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { appState.remove(); void supabase.removeChannel(channel); };
  }, [user]);
  const requestCancellation = () => Alert.alert(
    'Cancel subscription?',
    'Future renewals will stop. Your current access remains available until the period shown here ends.',
    [
      { text: 'Keep plan', style: 'cancel' },
      { text: 'Cancel subscription', style: 'destructive', onPress: () => void (async () => {
        setCancelling(true); setError(null);
        try { await cancelSubscription(); await load(false); }
        catch (caught) { setError(friendlyError(caught, 'The subscription could not be cancelled.')); }
        finally { setCancelling(false); }
      })() },
    ],
  );
  return (
    <PageScreen title="Billing" subtitle="Subscription and receipts">
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
        <View style={{ gap: 14 }}>
          {subscription ? (
            <SectionCard title="Current subscription">
              <AppText variant="title">{subscription.jela_plans?.name ?? 'Jela AI plan'}</AppText>
              <AppText tone={subscription.status === 'active' ? 'success' : 'accent'} variant="label">{subscription.status.replace('_', ' ')}</AppText>
              {subscription.current_period_end ? <AppText tone="muted">Current period ends {formatDate(subscription.current_period_end)}</AppText> : null}
              {subscription.cancel_at_period_end ? <AppText tone="accent">This subscription will end after the current period.</AppText> : null}
              {!subscription.cancel_at_period_end && ['active', 'trialing', 'past_due'].includes(subscription.status) ? (
                <Button variant="secondary" loading={cancelling} onPress={requestCancellation}>Cancel subscription</Button>
              ) : null}
            </SectionCard>
          ) : <EmptyState title="No active subscription" message="When you subscribe through an enabled Jela AI checkout, its server-confirmed status will appear here." />}
          <AppText variant="title">Billing history</AppText>
          {!records.length ? <AppText tone="muted">No billing records yet.</AppText> : records.map((row) => (
            <SectionCard key={row.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}><AppText variant="label">{row.description ?? 'Jela AI purchase'}</AppText><AppText tone="muted" variant="caption">{formatDate(row.created_at)} · {row.status}</AppText></View>
                <AppText variant="title">{formatMoney(row.amount_minor, row.currency)}</AppText>
              </View>
              {row.receipt_url ? <Button variant="secondary" onPress={() => Linking.openURL(row.receipt_url!)}>Open receipt</Button> : null}
            </SectionCard>
          ))}
        </View>
      )}
    </PageScreen>
  );
}
