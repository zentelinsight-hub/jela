import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { TextField } from '@/components/text-field';
import { getSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { setAccountStatus } from '@/services/admin';
import type { AccountStatus } from '@/types/database';

type Row = { id: string; first_name: string; last_name: string; display_name: string | null; status: string; status_reason: string | null; created_at: string };

export default function AdminAccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [account, setAccount] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); const result = await getSupabase().from('jela_accounts').select('id,first_name,last_name,display_name,status,status_reason,created_at').eq('id', id).single(); if (result.error) setError(friendlyError(result.error, 'Could not load this account.')); else { setAccount(result.data as Row); setError(null); } setLoading(false); }, [id]);
  useEffect(() => { void load(); }, [load]);
  const changeStatus = async (status: AccountStatus) => { if (status !== 'active' && reason.trim().length < 3) { setError('Enter a clear reason before restricting access.'); return; } setWorking(true); try { await setAccountStatus(id, status, reason); await load(); } catch (e) { setError(friendlyError(e, 'Could not change account status.')); } finally { setWorking(false); } };
  return <PageScreen title="Account" subtitle="Server-authoritative status">{loading ? <LoadingState /> : error && !account ? <ErrorState message={error} onRetry={() => void load()} /> : account ? <View style={{ gap: 14 }}><SectionCard title={account.display_name || `${account.first_name} ${account.last_name}`}><AppText tone={account.status === 'active' ? 'success' : 'danger'} variant="label">{account.status}</AppText>{account.status_reason ? <AppText tone="muted">Reason: {account.status_reason}</AppText> : null}<AppText tone="muted" variant="caption">User ID: {account.id}</AppText></SectionCard><TextField label="Status reason" value={reason} onChangeText={setReason} multiline hint="Required for restricted, suspended, or deactivated states." /><View style={{ gap: 9 }}><Button loading={working} onPress={() => void changeStatus('active')}>Set active</Button><Button variant="secondary" loading={working} onPress={() => void changeStatus('restricted')}>Set restricted</Button><Button variant="danger" loading={working} onPress={() => void changeStatus('suspended')}>Suspend account</Button><Button variant="danger" loading={working} onPress={() => void changeStatus('deactivated')}>Deactivate Jela AI account</Button></View>{error ? <AppText tone="danger">{error}</AppText> : null}</View> : null}</PageScreen>;
}
