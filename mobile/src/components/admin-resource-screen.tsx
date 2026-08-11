import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { formatDate } from '@/lib/format';
import { friendlyError } from '@/lib/errors';
import { fetchAdminRows } from '@/services/admin';
import { getSupabase } from '@/lib/supabase';

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDate(value);
  return String(value);
}

export function AdminResourceScreen({
  title,
  subtitle,
  table,
  columns = '*',
  primaryField = 'id',
  secondaryFields = [],
}: {
  title: string;
  subtitle: string;
  table: string;
  columns?: string;
  primaryField?: string;
  secondaryFields?: string[];
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try { setRows(await fetchAdminRows(table, columns) as Record<string, unknown>[]); setError(null); }
    catch (loadError) { setError(friendlyError(loadError, `Could not load ${title.toLowerCase()}.`)); }
    finally { if (showLoading) setLoading(false); }
  }, [columns, table, title]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase.channel(`admin-${table}-live`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => void load(false))
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void load(false); });
    return () => { appState.remove(); void supabase.removeChannel(channel); };
  }, [load, table]);
  return (
    <PageScreen title={title} subtitle={subtitle}>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !rows.length ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} message="The backend returned an empty authoritative result. No placeholder records are shown." />
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((row, index) => (
            <SectionCard key={String(row.id ?? index)}>
              <AppText variant="label" numberOfLines={2}>{displayValue(row[primaryField])}</AppText>
              {secondaryFields.map((field) => <View key={field} style={{ flexDirection: 'row', gap: 10 }}><AppText tone="muted" variant="caption" style={{ width: 105 }}>{field.replaceAll('_', ' ')}</AppText><AppText variant="caption" style={{ flex: 1 }} numberOfLines={4}>{displayValue(row[field])}</AppText></View>)}
            </SectionCard>
          ))}
        </View>
      )}
    </PageScreen>
  );
}
