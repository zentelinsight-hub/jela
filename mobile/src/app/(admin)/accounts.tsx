import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { fetchAdminAccounts, type AdminAccountRow } from '@/services/admin';
import { radius } from '@/theme/tokens';

export default function AdminAccountsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<AdminAccountRow[]>([]);
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (nextOffset = 0, nextQuery = '') => { setLoading(true); try { const result = await fetchAdminAccounts(nextQuery, 30, nextOffset); setRows(result.rows); setTotal(result.total); setError(null); } catch (e) { setError(friendlyError(e, 'Could not load accounts.')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(0, ''); }, [load]);
  return <PageScreen title="Accounts" subtitle={`${total} identities`}><View style={{ gap: 12 }}><TextField label="Search accounts" value={query} onChangeText={setQuery} placeholder="Email, username, name, or user ID" returnKeyType="search" onSubmitEditing={() => { setOffset(0); void load(0, query); }} /><Button variant="secondary" onPress={() => { setOffset(0); void load(0, query); }}>Search</Button>{loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !rows.length ? <EmptyState title="No matching accounts" message="Try a different search." /> : <View style={{ gap: 10 }}>{rows.map((row) => <Pressable key={row.id} onPress={() => router.push(`/(admin)/account/${row.id}` as Href)} style={({ pressed }) => ({ padding: 15, gap: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceElevated : colors.surface })}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><AppText variant="label" style={{ flex: 1 }}>{row.display_name || `${row.first_name} ${row.last_name}`}</AppText><AppText tone={row.status === 'active' ? 'success' : 'danger'} variant="caption">{row.status}</AppText></View><AppText tone="muted" variant="caption">{row.email ?? 'No email'}{row.username ? ` · @${row.username}` : ''}</AppText><AppText tone="muted" variant="caption">{row.plan_name ?? 'Free'}{row.is_admin ? ' · Administrator' : ''}</AppText></Pressable>)}<View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Button fullWidth variant="secondary" disabled={offset === 0} onPress={() => { const next = Math.max(0, offset - 30); setOffset(next); void load(next); }}>Previous</Button></View><View style={{ flex: 1 }}><Button fullWidth variant="secondary" disabled={offset + rows.length >= total} onPress={() => { const next = offset + 30; setOffset(next); void load(next); }}>Next</Button></View></View></View>}</View></PageScreen>;
}
