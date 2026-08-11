import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { TextField } from '@/components/text-field';
import { getSupabase } from '@/lib/supabase';
import { restoreAccount, suspendAccount } from '@/services/admin';

type Row = { id: string; first_name: string; last_name: string; display_name: string | null; status: string; status_reason: string | null; created_at: string };

export default function AdminAccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [account, setAccount] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { setLoading(true); const result = await getSupabase().from('jela_accounts').select('id,first_name,last_name,display_name,status,status_reason,created_at').eq('id', id).single(); if (result.error) setError(result.error.message); else { setAccount(result.data as Row); setError(null); } setLoading(false); };
  useEffect(() => { void load(); }, [id]);
  const changeStatus = async (action: 'suspend' | 'restore') => { if (action === 'suspend' && reason.trim().length < 3) { setError('Enter a clear suspension reason.'); return; } setWorking(true); try { if (action === 'suspend') await suspendAccount(id, reason); else await restoreAccount(id); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not change account status.'); } finally { setWorking(false); } };
  return <PageScreen title="Account" subtitle="Server-authoritative status">{loading ? <LoadingState /> : error && !account ? <ErrorState message={error} onRetry={() => void load()} /> : account ? <View style={{ gap: 14 }}><SectionCard title={account.display_name || `${account.first_name} ${account.last_name}`}><AppText tone={account.status === 'active' ? 'success' : 'danger'} variant="label">{account.status}</AppText>{account.status_reason ? <AppText tone="muted">Reason: {account.status_reason}</AppText> : null}<AppText tone="muted" variant="caption">User ID: {account.id}</AppText></SectionCard>{account.status === 'active' ? <><TextField label="Suspension reason" value={reason} onChangeText={setReason} multiline /><Button variant="danger" loading={working} onPress={() => void changeStatus('suspend')}>Suspend account</Button></> : <Button loading={working} onPress={() => void changeStatus('restore')}>Restore active access</Button>}{error ? <AppText tone="danger">{error}</AppText> : null}</View> : null}</PageScreen>;
}
