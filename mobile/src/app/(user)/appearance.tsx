import { Check, Moon, Smartphone, Sun } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PageScreen } from '@/components/page-screen';
import { useAppTheme } from '@/contexts/theme-context';
import { radius, type ThemePreference } from '@/theme/tokens';

const choices = [
  { value: 'system' as const, label: 'Use device setting', description: 'Follow Android light or dark mode.', Icon: Smartphone },
  { value: 'light' as const, label: 'Light', description: 'Use the light Jela AI palette.', Icon: Sun },
  { value: 'dark' as const, label: 'Dark', description: 'Use the dark Jela AI palette.', Icon: Moon },
];

export default function AppearanceScreen() {
  const { preference, setPreference, colors } = useAppTheme();
  return (
    <PageScreen title="Appearance" subtitle="Light, dark, or system">
      <View style={{ gap: 12 }}>
        {choices.map(({ value, label, description, Icon }) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: preference === value }}
            onPress={() => void setPreference(value as ThemePreference)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16,
              borderRadius: radius.md, borderWidth: 1,
              borderColor: preference === value ? colors.primary : colors.border,
              backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
            })}
          >
            <Icon color={preference === value ? colors.primary : colors.textMuted} />
            <View style={{ flex: 1 }}><AppText variant="label">{label}</AppText><AppText tone="muted" variant="caption">{description}</AppText></View>
            {preference === value ? <Check color={colors.primary} /> : null}
          </Pressable>
        ))}
      </View>
    </PageScreen>
  );
}
