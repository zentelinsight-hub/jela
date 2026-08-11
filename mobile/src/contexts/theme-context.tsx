import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';

import {
  darkPalette,
  lightPalette,
  type Palette,
  type ThemePreference,
} from '@/theme/tokens';

const preferenceKey = 'jela.theme.preference';

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  colors: Palette;
  setPreference: (value: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(preferenceKey).then((stored) => {
      if (stored === 'system' || stored === 'light' || stored === 'dark') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const resolved: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      colors: resolved === 'dark' ? darkPalette : lightPalette,
      setPreference: async (nextPreference) => {
        setPreferenceState(nextPreference);
        await AsyncStorage.setItem(preferenceKey, nextPreference);
        Appearance.setColorScheme(nextPreference === 'system' ? 'unspecified' : nextPreference);
      },
    }),
    [preference, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside ThemeProvider.');
  return value;
}
