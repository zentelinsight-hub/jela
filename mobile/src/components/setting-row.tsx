import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useAppTheme } from '@/contexts/theme-context';
import { radius } from '@/theme/tokens';

export function SettingRow({
  title,
  description,
  icon,
  value,
  onPress,
  danger = false,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
      })}
    >
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" tone={danger ? 'danger' : 'default'}>{title}</AppText>
        {description ? <AppText tone="muted" variant="caption">{description}</AppText> : null}
      </View>
      {value ? <AppText tone="muted" variant="caption">{value}</AppText> : null}
      {onPress ? <ChevronRight color={colors.textMuted} size={19} /> : null}
    </Pressable>
  );
}
