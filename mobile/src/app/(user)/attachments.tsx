import { FileText } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useFeatures } from '@/contexts/feature-context';
import { useAppTheme } from '@/contexts/theme-context';
import { formatDate } from '@/lib/format';
import { friendlyError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

type Attachment = { id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string };

export default function AttachmentsScreen() {
  const { flags } = useFeatures();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    const { data, error: queryError } = await getSupabase().from('jela_attachments').select('id,file_name,mime_type,size_bytes,created_at').eq('status', 'ready').order('created_at', { ascending: false });
    if (queryError) setError(friendlyError(queryError, 'Could not load attachments.')); else { setItems((data ?? []) as Attachment[]); setError(null); }
    setLoading(false);
  };
  useEffect(() => { if (flags.attachments_enabled) void load(); else setLoading(false); }, [flags.attachments_enabled]);
  return (
    <PageScreen title="Attachments" subtitle="Private files">
      {!flags.attachments_enabled ? <EmptyState title="Attachments are not enabled" message="This route stays unavailable until the backend feature flag and storage policy are enabled." /> : loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !items.length ? <EmptyState title="No attachments" message="Files added to an enabled chat will appear here." /> : (
        <View style={{ gap: 10 }}>{items.map((item) => <SectionCard key={item.id}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><FileText color={colors.primary} /><View style={{ flex: 1 }}><AppText variant="label" numberOfLines={2}>{item.file_name}</AppText><AppText tone="muted" variant="caption">{(item.size_bytes / 1024 / 1024).toFixed(2)} MB · {formatDate(item.created_at)}</AppText></View></View></SectionCard>)}</View>
      )}
    </PageScreen>
  );
}
