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
  BellRing,
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
import { friendlyError } from '@/lib/errors';
import { fetchAdminOverview, fetchAdminWorkspaceMetrics, type AdminWorkspaceMetrics } from '@/services/admin';
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
  ['Notifications', '/(admin)/notifications', BellRing],
  ['Security', '/(admin)/security', ShieldCheck],
  ['Audit log', '/(admin)/audit', BookOpenCheck],
  ['Settings', '/(admin)/settings', Settings],
] as const;

export default function AdminHomeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [workspace, setWorkspace] = useState<AdminWorkspaceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try { const [nextOverview, nextWorkspace] = await Promise.all([fetchAdminOverview(), fetchAdminWorkspaceMetrics()]); setOverview(nextOverview); setWorkspace(nextWorkspace); setError(null); }
    catch (loadError) { setError(friendlyError(loadError, 'Could not load the admin overview.')); }
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
          {workspace ? <SectionCard title="Workspace health"><AppText>Projects: {workspace.active_projects} · Memories: {workspace.active_memories}</AppText><AppText>Files: {workspace.stored_files} · Storage: {(workspace.storage_bytes / 1048576).toFixed(1)} MB</AppText><AppText>Images: {workspace.generated_images} · Web searches: {workspace.web_searches}</AppText><AppText tone={workspace.jobs.failed > 0 ? 'danger' : 'success'}>Jobs: {workspace.jobs.queued} queued · {workspace.jobs.processing} processing · {workspace.jobs.failed} failed</AppText><AppText tone={workspace.embeddings.memory_failed + workspace.embeddings.file_failed > 0 ? 'danger' : 'success'}>Embeddings: {workspace.embeddings.memory_ready} memories · {workspace.embeddings.file_ready} file chunks ready</AppText><AppText tone="muted" variant="caption">Counts and processing health only. Private memory and file content is not exposed.</AppText></SectionCard> : null}
          <AppText variant="title">Operations</AppText>
          {links.map(([title, path, Icon]) => <SettingRow key={path} title={title} icon={<Icon color={colors.textMuted} />} onPress={() => router.push(path as Href)} />)}
        </View>
      ) : <EmptyState title="No overview" message="The server returned no administration data." />}
    </PageScreen>
  );
}
