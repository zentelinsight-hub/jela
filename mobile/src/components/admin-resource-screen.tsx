import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { formatDate } from '@/lib/format';
import { fetchAdminRows } from '@/services/admin';

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
  const load = async () => {
    setLoading(true);
    try { setRows(await fetchAdminRows(table, columns) as Record<string, unknown>[]); setError(null); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : `Could not load ${title.toLowerCase()}.`); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [table, columns]);
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
