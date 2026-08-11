import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useAppTheme } from '@/contexts/theme-context';
import { radius } from '@/theme/tokens';

export function SectionCard({ title, children }: PropsWithChildren<{ title?: string }>) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        gap: 12,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 16,
      }}
    >
      {title ? <AppText variant="title">{title}</AppText> : null}
      {children}
    </View>
  );
}
