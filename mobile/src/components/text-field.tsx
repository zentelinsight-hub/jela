import type { ComponentProps } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useAppTheme } from '@/contexts/theme-context';
import { radius } from '@/theme/tokens';

type Props = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string | null;
  hint?: string;
};

export function TextField({ label, error, hint, style, ...props }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 7 }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        {...props}
        style={[
          {
            minHeight: props.multiline ? 112 : 50,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 16,
            paddingHorizontal: 14,
            paddingVertical: 12,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          style,
        ]}
      />
      {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
      {!error && hint ? <AppText tone="muted" variant="caption">{hint}</AppText> : null}
    </View>
  );
}
