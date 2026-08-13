import { useFocusEffect } from 'expo-router';
import { Smartphone, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { fetchRegisteredDevices, revokeRegisteredDevice, type RegisteredDevice } from '@/services/notifications';

export default function DevicesScreen() {
  const { colors } = useAppTheme();
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [currentId, setCurrentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const result = await fetchRegisteredDevices(); setDevices(result.devices); setCurrentId(result.currentInstallationId); setError(null); }
    catch (caught) { setError(friendlyError(caught, 'Your registered devices could not be loaded.')); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const revoke = (device: RegisteredDevice) => Alert.alert(
    'Remove this device?',
    'Jela will stop push notifications for this installation. Authentication refresh tokens are managed separately by Supabase Auth.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void revokeRegisteredDevice(device.installation_id).then(load).catch((caught) => setError(friendlyError(caught, 'The device could not be removed.'))) }],
  );
  return <PageScreen title="Devices" subtitle="Registered Jela AI installations">
    {loading ? <LoadingState /> : error && !devices.length ? <ErrorState message={error} onRetry={() => void load()} /> : !devices.length ? <EmptyState icon={<Smartphone color={colors.primary} />} title="No registered devices" message="A physical Android device appears here after notifications are enabled." /> : <View style={{ gap: 12 }}>
      {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
      {devices.map((device) => <SectionCard key={device.id}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Smartphone color={device.revoked_at ? colors.textMuted : colors.primary} /><View style={{ flex: 1 }}><AppText variant="label">{device.device_name}{device.installation_id === currentId ? ' · This device' : ''}</AppText><AppText tone="muted" variant="caption">Android {device.app_version ? `· Jela ${device.app_version} ` : ''}· Seen {formatDate(device.last_seen_at)}</AppText><AppText tone={device.revoked_at ? 'danger' : 'success'} variant="caption">{device.revoked_at ? 'Removed' : 'Active notification registration'}</AppText></View>{!device.revoked_at ? <Pressable accessibilityLabel={`Remove ${device.device_name}`} onPress={() => revoke(device)}><Trash2 color={colors.danger} /></Pressable> : null}</View></SectionCard>)}
    </View>}
  </PageScreen>;
}
