import { Activity, Brain, Clock3, FileText, FolderKanban, Image as ImageIcon, Search } from 'lucide-react-native';
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
import { workspaceService } from '@/services/workspace';
import type { UsageState } from '@/types/database';
import type { WorkspaceUsage } from '@/types/workspace';

const bytes = (value: number) => value < 1048576 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1048576).toFixed(1)} MB`;

export default function UsageScreen() {
  const { colors } = useAppTheme();
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try {
      const [chat, product] = await Promise.all([fetchUsageState(), workspaceService.usage()]);
      setUsage(chat); setWorkspace(product); setError(null);
    } catch (caught) { setError(friendlyError(caught, 'Could not load usage.')); }
  };
  useEffect(() => { void load(); }, []);
  const meter = (key: string) => workspace?.usage.meters.find((item) => item.meter_key === key)?.used ?? 0;
  const limit = (key: string) => workspace?.entitlements.limits[key] ?? 0;
  return (
    <PageScreen title="Usage" subtitle="Simple, separate limits for your Jela workspace">
      {!usage && !error ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : usage && workspace ? (
        <View style={{ gap: 14 }}>
          <SectionCard title={usage.plan_name}>
            <Activity color={usage.usage_available ? colors.success : colors.danger} size={28} />
            <AppText variant="title">{usage.usage_available ? 'Jela is ready' : 'Chat usage limit reached'}</AppText>
            <AppText tone="muted">Limits are enforced securely on the server. Reaching one category does not block unrelated features.</AppText>
          </SectionCard>
          <SectionCard title="Workspace">
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}><FolderKanban color={colors.primary} /><AppText style={{ flex: 1 }}>Projects</AppText><AppText variant="label">{workspace.usage.projects} / {limit('max_projects')}</AppText></View>
              <View style={{ flexDirection: 'row', gap: 10 }}><Brain color={colors.accent} /><AppText style={{ flex: 1 }}>Memory</AppText><AppText variant="label">{workspace.usage.memories} / {limit('memory_item_limit')}</AppText></View>
              <View style={{ flexDirection: 'row', gap: 10 }}><FileText color={colors.success} /><AppText style={{ flex: 1 }}>Storage</AppText><AppText variant="label">{bytes(workspace.usage.storageBytes)} / {bytes(limit('storage_bytes_limit'))}</AppText></View>
              <View style={{ flexDirection: 'row', gap: 10 }}><Search color={colors.primary} /><AppText style={{ flex: 1 }}>Web research</AppText><AppText variant="label">{meter('web_search')} / {limit('web_search_limit')}</AppText></View>
              <View style={{ flexDirection: 'row', gap: 10 }}><ImageIcon color={colors.accent} /><AppText style={{ flex: 1 }}>Image creation</AppText><AppText variant="label">{meter('image_generation')} / {limit('image_generation_limit')}</AppText></View>
            </View>
          </SectionCard>
          {usage.next_free_reset_at ? <SectionCard title="Next Free reset"><Clock3 color={colors.primary} /><AppText>{formatDate(usage.next_free_reset_at)}</AppText></SectionCard> : null}
          <SectionCard title="Available chat modes"><AppText>{usage.allowed_modes.map((mode) => mode.replace('_', ' ')).join(' · ')}</AppText></SectionCard>
        </View>
      ) : null}
    </PageScreen>
  );
}
