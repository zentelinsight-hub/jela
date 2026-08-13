import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Switch, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { fetchAdminRows, fetchProviderHealth, updateAdminConfig } from '@/services/admin';
import { getSupabase } from '@/lib/supabase';
import { rotateAdminAccessCode } from '@/services/security';

const booleanKeys = ['global_ai_enabled', 'chat_enabled', 'streaming_enabled', 'research_enabled', 'image_generation_enabled', 'memory_enabled', 'memory_auto_save_enabled', 'projects_enabled', 'project_instructions_enabled', 'project_memory_enabled', 'workspace_files_enabled', 'file_analysis_enabled', 'document_processing_enabled', 'semantic_retrieval_enabled', 'hybrid_retrieval_enabled', 'push_notifications_enabled', 'trials_enabled', 'ai_maintenance_mode'] as const;
const numericKeys = [
  ['workspace_retrieval_top_k', 'Retrieval top K', 1, 20],
  ['workspace_retrieval_min_rank', 'Minimum retrieval rank', 0, 1],
  ['workspace_semantic_weight', 'Semantic weight', 0, 1],
  ['workspace_keyword_weight', 'Keyword weight', 0, 1],
] as const;
type Row = { key: string; value: unknown; description?: string };

export default function AdminSettingsScreen() {
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [health, setHealth] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newAccessCode, setNewAccessCode] = useState('');
  const [rotating, setRotating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [numericValues, setNumericValues] = useState<Record<string, string>>({});
  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [config, nextHealth] = await Promise.all([fetchAdminRows('jela_app_config', 'key,value,description'), fetchProviderHealth()]);
      const nextRows=config as Row[];setRows(nextRows);setNumericValues(Object.fromEntries(numericKeys.map(([key])=>[key,String(nextRows.find((row)=>row.key===key)?.value??'')])));setHealth(nextHealth); setError(null);
    } catch (caught) { setError(friendlyError(caught, 'Could not load Admin settings.')); }
    finally { if (showLoading) setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase.channel('admin-app-config-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_app_config' }, () => void load(false))
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void load(false); });
    return () => { appState.remove(); void supabase.removeChannel(channel); };
  }, []);
  const toggle = async (key: string, value: boolean) => {
    const previous = rows.find((row) => row.key === key)?.value === true;
    setSavingKey(key); setError(null);
    setRows((current) => current.map((row) => row.key === key ? { ...row, value } : row));
    try { await updateAdminConfig(key, value); }
    catch (caught) {
      setRows((current) => current.map((row) => row.key === key ? { ...row, value: previous } : row));
      setError(friendlyError(caught, 'The setting was not saved.'));
    } finally { setSavingKey(null); }
  };
  return <PageScreen title="App settings" subtitle="Audited production controls">
    {loading ? <LoadingState /> : error && !rows.length ? <ErrorState message={error} onRetry={() => void load()} /> : <View style={{ gap: 14 }}>
      {error ? <AppText tone="danger">{error}</AppText> : null}
      <SectionCard title="System health">{Object.entries(health ?? {}).map(([key, value]) => <AppText key={key}>{key.replaceAll('_', ' ')}: {value}</AppText>)}<AppText tone="muted" variant="caption">Only configuration and operational state is shown. Provider secrets never reach this app.</AppText></SectionCard>
      <SectionCard title="Rotate Admin access code"><AppText tone="muted">Rotation invalidates other Admin access grants. The new code is salted and hashed before storage.</AppText><TextField label="New access code" value={newAccessCode} onChangeText={setNewAccessCode} secureTextEntry autoComplete="off" />{notice ? <AppText tone="success" variant="caption">{notice}</AppText> : null}<Button loading={rotating} disabled={newAccessCode.length < 8} onPress={() => void (async () => { setRotating(true); setError(null); setNotice(null); try { await rotateAdminAccessCode(newAccessCode); setNewAccessCode(''); setNotice('Admin access code rotated.'); } catch (caught) { setError(friendlyError(caught, 'The access code could not be rotated.')); } finally { setRotating(false); } })()}>Rotate code</Button></SectionCard>
      {booleanKeys.map((key) => { const row = rows.find((item) => item.key === key); return <SectionCard key={key}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ flex: 1 }}><AppText variant="label">{key.replaceAll('_', ' ')}</AppText>{row?.description ? <AppText tone="muted" variant="caption">{row.description}</AppText> : null}</View>{savingKey === key ? <ActivityIndicator color={colors.primary} /> : null}<Switch disabled={savingKey === key} accessibilityLabel={key.replaceAll('_', ' ')} trackColor={{ true: colors.primary }} value={row?.value === true} onValueChange={(value) => void toggle(key, value)} /></View></SectionCard> })}
      <SectionCard title="Search & retrieval"><AppText tone="muted">Safe bounded controls for semantic and keyword retrieval. Raw embeddings are never shown.</AppText>{numericKeys.map(([key,label,min,max])=><TextField key={key} label={label} value={numericValues[key]??''} onChangeText={(value)=>setNumericValues((all)=>({...all,[key]:value}))} keyboardType="decimal-pad" hint={`${min} to ${max}`}/>)}<Button loading={savingKey==='retrieval'} onPress={()=>void(async()=>{const parsed=Object.fromEntries(numericKeys.map(([key,,min,max])=>{const value=Number(numericValues[key]);if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${key.replaceAll('_',' ')} must be between ${min} and ${max}.`);return[key,value];}));setSavingKey('retrieval');setError(null);try{for(const[key,value]of Object.entries(parsed))await updateAdminConfig(key,value);setNotice('Retrieval configuration saved and audited.');}catch(caught){setError(friendlyError(caught,'Retrieval configuration was not saved.'));}finally{setSavingKey(null);}})()}>Save retrieval configuration</Button></SectionCard>
    </View>}
  </PageScreen>;
}
