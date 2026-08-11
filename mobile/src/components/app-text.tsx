import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';

type Props = ComponentProps<typeof Text> & {
  tone?: 'default' | 'muted' | 'danger' | 'success' | 'accent';
  variant?: 'body' | 'caption' | 'label' | 'title' | 'headline' | 'display';
};

const sizes = {
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const },
  title: { fontSize: 20, lineHeight: 27, fontWeight: '700' as const },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
  display: { fontSize: 36, lineHeight: 42, fontWeight: '800' as const },
};

export function AppText({ tone = 'default', variant = 'body', style, ...props }: Props) {
  const { colors } = useAppTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    danger: colors.danger,
    success: colors.success,
    accent: colors.accent,
  }[tone];

  return <Text {...props} style={[sizes[variant], { color }, style]} />;
}
