import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { fetchAdminRows, fetchProviderHealth, updateAdminConfig } from '@/services/admin';

const booleanKeys = ['global_ai_enabled', 'chat_enabled', 'streaming_enabled', 'research_enabled', 'images_enabled', 'memory_enabled', 'trials_enabled', 'ai_maintenance_mode'] as const;
type Row = { key: string; value: unknown; description?: string };

export default function AdminSettingsScreen() {
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [health, setHealth] = useState<{ openai: string; paystack: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const [config, nextHealth] = await Promise.all([fetchAdminRows('jela_app_config', 'key,value,description'), fetchProviderHealth()]);
      setRows(config as Row[]); setHealth(nextHealth); setError(null);
    } catch (caught) { setError(friendlyError(caught, 'Could not load Admin settings.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const toggle = async (key: string, value: boolean) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, value } : row));
    try { await updateAdminConfig(key, value); }
    catch (caught) { setError(friendlyError(caught, 'The setting was not saved.')); await load(); }
  };
  return <PageScreen title="App settings" subtitle="Audited production controls">
    {loading ? <LoadingState /> : error && !rows.length ? <ErrorState message={error} onRetry={() => void load()} /> : <View style={{ gap: 14 }}>
      {error ? <AppText tone="danger">{error}</AppText> : null}
      <SectionCard title="Provider readiness"><AppText>OpenAI: {health?.openai ?? 'unavailable'}</AppText><AppText>Paystack: {health?.paystack ?? 'unavailable'}</AppText><AppText tone="muted" variant="caption">Only configuration state is shown. Provider secrets never reach this app.</AppText></SectionCard>
      {booleanKeys.map((key) => { const row = rows.find((item) => item.key === key); return <SectionCard key={key}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ flex: 1 }}><AppText variant="label">{key.replaceAll('_', ' ')}</AppText>{row?.description ? <AppText tone="muted" variant="caption">{row.description}</AppText> : null}</View><Switch accessibilityLabel={key.replaceAll('_', ' ')} trackColor={{ true: colors.primary }} value={row?.value === true} onValueChange={(value) => void toggle(key, value)} /></View></SectionCard> })}
    </View>}
  </PageScreen>;
}
