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
    <View
      style={{
        minHeight: 62,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
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
      <View style={{ flex: 1 }}>
        <AppText variant="title" numberOfLines={1}>{title}</AppText>
        {subtitle ? <AppText tone="muted" variant="caption" numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
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
  );
}
