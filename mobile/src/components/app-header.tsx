import { ChevronLeft, Menu, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useAppTheme } from '@/contexts/theme-context';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  onNew?: () => void;
  action?: ReactNode;
};

export function AppHeader({ title, subtitle, onBack, onMenu, onNew, action }: Props) {
  const { colors } = useAppTheme();
  const iconColor = colors.text;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background }}>
      <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}>
      {onBack || onMenu ? (
        <Pressable
          accessibilityLabel={onBack ? 'Go back' : 'Open menu'}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack ?? onMenu}
          style={{ padding: 6 }}
        >
          {onBack ? <ChevronLeft color={iconColor} /> : <Menu color={iconColor} />}
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }} />
      {onNew ? (
        <Pressable
          accessibilityLabel="Start a new chat"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onNew}
          style={{ padding: 6 }}
        >
          <Plus color={iconColor} />
        </Pressable>
      ) : null}
      {action}
      </View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 13, gap: 3 }}>
        <AppText variant="title" numberOfLines={2}>{title}</AppText>
        {subtitle ? <AppText tone="muted" variant="caption" numberOfLines={2}>{subtitle}</AppText> : null}
      </View>
    </View>
  );
}
