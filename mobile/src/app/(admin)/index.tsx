import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import {
  Activity,
  BadgeDollarSign,
  BookOpenCheck,
  Bot,
  Coins,
  CreditCard,
  FileWarning,
  Gauge,
  PackageCheck,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { SettingRow } from '@/components/setting-row';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchAdminOverview } from '@/services/admin';
import type { AdminOverview } from '@/types/database';

const links = [
  ['Accounts', '/(admin)/accounts', Users],
  ['Plans', '/(admin)/plans', BadgeDollarSign],
  ['Subscriptions', '/(admin)/subscriptions', CreditCard],
  ['Credits', '/(admin)/credits', Coins],
  ['Model configuration', '/(admin)/model-configuration', Bot],
  ['Usage', '/(admin)/usage', Activity],
  ['Requests & errors', '/(admin)/requests-errors', FileWarning],
  ['Billing', '/(admin)/billing', Gauge],
  ['Releases', '/(admin)/releases', PackageCheck],
  ['Security', '/(admin)/security', ShieldCheck],
  ['Audit log', '/(admin)/audit', BookOpenCheck],
  ['Settings', '/(admin)/settings', Settings],
] as const;

export default function AdminHomeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try { setOverview(await fetchAdminOverview()); setError(null); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load the admin overview.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return (
    <PageScreen title="Admin console" subtitle="Jela AI operations">
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : overview ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              ['Accounts', overview.accounts], ['Conversations', overview.conversations], ['Messages', overview.messages],
              ['Active subscriptions', overview.activeSubscriptions], ['Failed requests', overview.failedRequests],
            ].map(([label, value]) => <SectionCard key={String(label)}><AppText variant="headline">{value}</AppText><AppText tone="muted" variant="caption">{label}</AppText></SectionCard>)}
          </View>
          <AppText variant="title">Operations</AppText>
          {links.map(([title, path, Icon]) => <SettingRow key={path} title={title} icon={<Icon color={colors.textMuted} />} onPress={() => router.push(path as Href)} />)}
        </View>
      ) : <EmptyState title="No overview" message="The server returned no administration data." />}
    </PageScreen>
  );
}
