import { AlertTriangle, Inbox, WifiOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useAppTheme } from '@/contexts/theme-context';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.primary} size="large" />
      <AppText tone="muted">{label}</AppText>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
      {icon ?? <Inbox color={colors.textMuted} size={34} />}
      <AppText variant="title" style={{ textAlign: 'center' }}>{title}</AppText>
      <AppText tone="muted" style={{ textAlign: 'center', maxWidth: 360 }}>{message}</AppText>
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <EmptyState
      icon={message.toLowerCase().includes('network') ? <WifiOff color={colors.danger} /> : <AlertTriangle color={colors.danger} />}
      title="Something went wrong"
      message={message}
      action={onRetry ? <Button variant="secondary" onPress={onRetry}>Try again</Button> : undefined}
    />
  );
}
