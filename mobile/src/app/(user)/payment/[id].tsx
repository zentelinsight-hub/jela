import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppText } from '@/components/app-text';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { getSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
type Row = { id: string; amount_minor: number; currency: string; status: string; description: string | null; created_at: string; provider_reference: string | null };
export default function PaymentDetailScreen() { const { id } = useLocalSearchParams<{ id: string }>(); const [row, setRow] = useState<Row | null>(null); const [error, setError] = useState<string | null>(null); useEffect(() => { void getSupabase().from('jela_billing_records').select('id,amount_minor,currency,status,description,created_at,provider_reference').eq('id', id).single().then(({ data, error: caught }) => caught ? setError(friendlyError(caught, 'Could not load this payment.')) : setRow(data as Row)); }, [id]); return <PageScreen title="Payment" subtitle="Server-confirmed billing record">{!row && !error ? <LoadingState /> : error ? <ErrorState message={error} /> : row ? <SectionCard title={row.description ?? 'Jela AI payment'}><AppText variant="headline">{formatMoney(row.amount_minor, row.currency)}</AppText><AppText>{row.status.replaceAll('_', ' ')}</AppText><AppText tone="muted">{formatDate(row.created_at)}</AppText>{row.provider_reference ? <AppText tone="muted" variant="caption">Reference: {row.provider_reference}</AppText> : null}</SectionCard> : null}</PageScreen>; }
