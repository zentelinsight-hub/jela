import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform, type AppStateStatus } from 'react-native';

import { getSupabase } from '@/lib/supabase';

const installationKey = 'jela.notification.installation-id';

export type NotificationPermissionState = {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  enabled: boolean;
};

export type InboxNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: string;
  created_at: string;
  read: boolean;
};

export type RegisteredDevice = {
  id: string; installation_id: string; platform: string; device_name: string; app_version: string | null;
  last_seen_at: string; revoked_at: string | null; created_at: string;
};

async function installationId() {
  const stored = await SecureStore.getItemAsync(installationKey);
  if (stored) return stored;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(installationKey, created);
  return created;
}

async function invoke<T>(body: Record<string, unknown>) {
  const result = await getSupabase().functions.invoke<T>('jela-notifications', { body });
  if (result.error) {
    const message = result.data && typeof result.data === 'object' && 'message' in result.data
      ? String(result.data.message) : result.error.message;
    throw new Error(message);
  }
  if (!result.data) throw new Error('The notification service returned no data.');
  return result.data;
}

export async function getNotificationPermission(): Promise<NotificationPermissionState> {
  const permission = await Notifications.getPermissionsAsync();
  return {
    status: permission.status,
    canAskAgain: permission.canAskAgain,
    enabled: permission.status === 'granted',
  };
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('jela-general', {
    name: 'Jela AI notifications',
    description: 'Account notices, administrator updates, and completed AI responses.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#FF7A1A',
    sound: 'default',
  });
}

export async function registerNotifications(requestPermission: boolean): Promise<NotificationPermissionState> {
  if (Platform.OS !== 'android' || !Device.isDevice) {
    throw new Error('Push notifications require a physical Android device.');
  }
  await ensureAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && requestPermission && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  const id = await installationId();
  if (permission.status !== 'granted') {
    await invoke({ action: 'disable', installationId: id, permissionStatus: permission.status });
    return { status: permission.status, canAskAgain: permission.canAskAgain, enabled: false };
  }
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Jela AI notification project configuration is missing.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await invoke({
    action: 'register',
    token: token.data,
    installationId: id,
    deviceName: Device.deviceName ?? 'Android device',
    appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '',
  });
  return { status: 'granted', canAskAgain: permission.canAskAgain, enabled: true };
}

export async function disableNotifications(permissionStatus: string = 'denied') {
  return invoke<{ enabled: false }>({ action: 'disable', installationId: await installationId(), permissionStatus });
}

export async function updateNotificationAppState(appState: AppStateStatus) {
  return invoke<{ updated: true }>({ action: 'state', installationId: await installationId(), appState });
}

export async function fetchNotificationInbox() {
  const result = await invoke<{ notifications: InboxNotification[] }>({ action: 'history' });
  return result.notifications;
}

export async function markNotificationRead(notificationId: string) {
  return invoke<{ read: true }>({ action: 'read', notificationId });
}

export async function fetchRegisteredDevices() {
  const result = await invoke<{ devices: RegisteredDevice[]; currentInstallationId: string }>({
    action: 'devices', installationId: await installationId(),
  });
  return result;
}

export async function revokeRegisteredDevice(targetInstallationId: string) {
  return invoke<{ revoked: true; currentDevice: boolean }>({
    action: 'revoke_device', targetInstallationId, installationId: await installationId(),
  });
}

export function configureNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
