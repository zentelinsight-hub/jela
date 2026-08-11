import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useAppTheme } from '@/contexts/theme-context';
import { radius } from '@/theme/tokens';

type Props = Omit<PressableProps, 'children'> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
};

export function Button({
  children,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  icon,
  style,
  ...props
}: Props) {
  const { colors } = useAppTheme();
  const isDisabled = Boolean(disabled || loading);
  const scheme = {
    primary: { background: colors.primary, border: colors.primary, text: '#FFFFFF' },
    secondary: { background: colors.surface, border: colors.border, text: colors.text },
    ghost: { background: 'transparent', border: 'transparent', text: colors.text },
    danger: { background: colors.danger, border: colors.danger, text: '#FFFFFF' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      {...props}
      style={({ pressed }) => [
        {
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.md,
          borderWidth: 1,
          paddingHorizontal: 18,
          opacity: isDisabled ? 0.48 : pressed ? 0.78 : 1,
          width: fullWidth ? '100%' : undefined,
          backgroundColor: scheme.background,
          borderColor: scheme.border,
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator color={scheme.text} /> : icon}
        <AppText variant="label" style={{ color: scheme.text }}>
          {children}
        </AppText>
      </View>
    </Pressable>
  );
}
