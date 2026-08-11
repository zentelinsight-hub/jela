import { Activity, Clock3 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { fetchUsageState } from '@/services/credits';
import type { UsageState } from '@/types/database';

export default function UsageScreen() {
  const { colors } = useAppTheme();
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try { setUsage(await fetchUsageState()); setError(null); }
    catch (caught) { setError(friendlyError(caught, 'Could not load usage.')); }
  };
  useEffect(() => { void load(); }, []);
  return (
    <PageScreen title="Usage" subtitle="Your current Jela AI access">
      {!usage && !error ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : usage ? (
        <View style={{ gap: 14 }}>
          <SectionCard title={usage.plan_name}>
            <Activity color={usage.usage_available ? colors.success : colors.danger} size={28} />
            <AppText variant="title">{usage.usage_available ? 'Ready to use' : 'Usage limit reached'}</AppText>
            <AppText tone="muted">Jela AI measures usage securely on the server. Internal model units are never exposed here.</AppText>
          </SectionCard>
          {usage.next_free_reset_at ? <SectionCard title="Next reset"><Clock3 color={colors.primary} /><AppText>{formatDate(usage.next_free_reset_at)}</AppText></SectionCard> : null}
          <SectionCard title="Available modes"><AppText>{usage.allowed_modes.map((mode) => mode.replace('_', ' ')).join(' · ')}</AppText></SectionCard>
        </View>
      ) : null}
    </PageScreen>
  );
}
