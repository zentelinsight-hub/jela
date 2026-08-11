import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';

type Props = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}>;

export function AppScreen({ children, scroll = true, padded = true, header, footer }: Props) {
  const { colors } = useAppTheme();
  const contentStyle = {
    flexGrow: 1,
    paddingHorizontal: padded ? 18 : 0,
    paddingVertical: padded ? 18 : 0,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[contentStyle, { flex: 1 }]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}
