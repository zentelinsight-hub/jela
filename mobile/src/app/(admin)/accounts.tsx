import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { fetchAdminRows } from '@/services/admin';
import { radius } from '@/theme/tokens';

type Row = { id: string; first_name: string; last_name: string; display_name: string | null; status: string; created_at: string };

export default function AdminAccountsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { setLoading(true); try { setRows(await fetchAdminRows('jela_accounts', 'id,first_name,last_name,display_name,status,created_at') as Row[]); setError(null); } catch (e) { setError(friendlyError(e, 'Could not load accounts.')); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  return <PageScreen title="Accounts" subtitle="Identity and status">{loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !rows.length ? <EmptyState title="No accounts" message="No authenticated Jela AI accounts exist yet." /> : <View style={{ gap: 10 }}>{rows.map((row) => <Pressable key={row.id} onPress={() => router.push(`/(admin)/account/${row.id}` as Href)} style={({ pressed }) => ({ padding: 15, gap: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceElevated : colors.surface })}><AppText variant="label">{row.display_name || `${row.first_name} ${row.last_name}`}</AppText><AppText tone={row.status === 'active' ? 'success' : 'danger'} variant="caption">{row.status}</AppText></Pressable>)}</View>}</PageScreen>;
}
