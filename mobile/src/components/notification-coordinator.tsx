import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import {
  configureNotificationPresentation,
  registerNotifications,
  updateNotificationAppState,
} from '@/services/notifications';

configureNotificationPresentation();

export function NotificationCoordinator() {
  const router = useRouter();
  const { session, profileComplete } = useAuth();
  const handledInitial = useRef(false);

  useEffect(() => {
    if (!session || !profileComplete) return;
    void registerNotifications(false).catch(() => undefined);
    const stateListener = AppState.addEventListener('change', (state) => {
      void updateNotificationAppState(state).catch(() => undefined);
      if (state === 'active') void registerNotifications(false).catch(() => undefined);
    });
    return () => stateListener.remove();
  }, [profileComplete, session]);

  useEffect(() => {
    const open = (data: Record<string, unknown>) => {
      if (data.kind === 'chat_complete' && typeof data.conversationId === 'string') {
        router.push({ pathname: '/(user)/conversation/[id]', params: { id: data.conversationId } });
      } else {
        router.push('/(user)/notifications' as Href);
      }
    };
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      open(response.notification.request.content.data ?? {});
    });
    if (!handledInitial.current) {
      handledInitial.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) open(response.notification.request.content.data ?? {});
      });
    }
    return () => responseListener.remove();
  }, [router]);

  return null;
}
