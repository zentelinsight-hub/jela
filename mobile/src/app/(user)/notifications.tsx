import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { Bell, BellOff, CheckCircle2, Inbox } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useFeatures } from '@/contexts/feature-context';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import {
  fetchNotificationInbox,
  getNotificationPermission,
  markNotificationRead,
  registerNotifications,
  type InboxNotification,
  type NotificationPermissionState,
} from '@/services/notifications';

export default function NotificationsScreen() {
  const { flags } = useFeatures();
  const { colors } = useAppTheme();
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const [inbox, setInbox] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextPermission, notifications] = await Promise.all([
        getNotificationPermission(), fetchNotificationInbox(),
      ]);
      setPermission(nextPermission); setInbox(notifications); setError(null);
    } catch (caught) { setError(friendlyError(caught, 'Notifications could not be loaded.')); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const turnOn = async () => {
    setWorking(true); setError(null);
    try {
      const result = await registerNotifications(true);
      setPermission(result);
      if (result.enabled) Alert.alert('Notifications are on', 'Jela AI can now notify you about completed responses and important updates.');
      else Alert.alert('Notifications remain off', result.canAskAgain
        ? 'You declined the Android notification request. You can try again whenever you are ready.'
        : 'Android will not ask again. Open system settings to enable Jela AI notifications.');
    } catch (caught) { setError(friendlyError(caught, 'Notifications could not be enabled.')); }
    finally { setWorking(false); }
  };

  if (loading) return <PageScreen title="Notifications"><LoadingState label="Checking Android notification access…" /></PageScreen>;
  return (
    <PageScreen title="Notifications" subtitle="Android alerts and your Jela AI inbox">
      {!flags.push_notifications_enabled ? <SectionCard><BellOff color={colors.textMuted} /><AppText variant="title">Temporarily unavailable</AppText><AppText tone="muted">Notification delivery is currently paused by Jela AI.</AppText></SectionCard> : (
        <SectionCard>
          {permission?.enabled ? <CheckCircle2 color={colors.success} size={34} /> : <Bell color={colors.accent} size={34} />}
          <AppText variant="title">{permission?.enabled ? 'Notifications are on' : 'Turn on notifications'}</AppText>
          <AppText tone="muted">{permission?.enabled
            ? 'Android can show Jela AI broadcasts and let you know when a response finishes while you are away.'
            : 'Jela AI will ask Android for permission only after you press the button below.'}</AppText>
          {!permission?.enabled ? <Button fullWidth loading={working} onPress={() => void turnOn()}>Turn on notifications</Button> : null}
          {!permission?.enabled && permission?.status === 'denied' && !permission.canAskAgain
            ? <Button fullWidth variant="secondary" onPress={() => void Linking.openSettings()}>Open Android settings</Button> : null}
        </SectionCard>
      )}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Inbox color={colors.textMuted} /><AppText variant="title">Inbox</AppText></View>
      {!inbox.length ? <SectionCard><AppText tone="muted">Important Jela AI updates will appear here.</AppText></SectionCard> : inbox.map((item) => (
        <Pressable key={item.id} onPress={() => {
          if (!item.read) {
            setInbox((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
            void markNotificationRead(item.id).catch(() => undefined);
          }
        }}>
          <SectionCard>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {!item.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
              <AppText variant="label" style={{ flex: 1 }}>{item.title}</AppText>
            </View>
            <AppText tone="muted">{item.body}</AppText>
            <AppText tone="muted" variant="caption">{new Date(item.created_at).toLocaleString()}</AppText>
          </SectionCard>
        </Pressable>
      ))}
    </PageScreen>
  );
}
