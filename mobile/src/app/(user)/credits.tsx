import { Coins } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { formatDate } from '@/lib/format';
import { fetchCreditLedger, fetchCreditWallet } from '@/services/credits';
import type { CreditWallet } from '@/types/database';

type LedgerRow = { id: string; amount: number; kind: string; description: string | null; created_at: string };

export default function CreditsScreen() {
  const { colors } = useAppTheme();
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const [nextWallet, rows] = await Promise.all([fetchCreditWallet(), fetchCreditLedger()]);
      setWallet(nextWallet); setLedger(rows as LedgerRow[]); setError(null);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load credits.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  return (
    <PageScreen title="Credits" subtitle="Server-authoritative balance">
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
        <View style={{ gap: 14 }}>
          <SectionCard>
            <Coins color={colors.primary} size={28} />
            <AppText variant="display">{wallet?.balance ?? 0}</AppText>
            <AppText tone="muted">Available credits</AppText>
            <AppText tone="muted" variant="caption">{wallet?.reserved ?? 0} reserved for in-progress requests</AppText>
          </SectionCard>
          <AppText variant="title">Activity</AppText>
          {!ledger.length ? <AppText tone="muted">No credit activity yet.</AppText> : ledger.map((row) => (
            <SectionCard key={row.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{row.description || row.kind.replaceAll('_', ' ')}</AppText>
                  <AppText tone="muted" variant="caption">{formatDate(row.created_at)}</AppText>
                </View>
                <AppText tone={row.amount >= 0 ? 'success' : 'default'} variant="title">{row.amount >= 0 ? '+' : ''}{row.amount}</AppText>
              </View>
            </SectionCard>
          ))}
        </View>
      )}
    </PageScreen>
  );
}
