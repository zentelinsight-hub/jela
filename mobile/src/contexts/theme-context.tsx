import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Appearance, useColorScheme } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { getSupabase } from '@/lib/supabase';

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
  const { session, verified } = useAuth();
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  const applyPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  }, []);

  const reconcile = useCallback(async () => {
    if (!session || !verified) return;
    const { data, error } = await getSupabase()
      .from('jela_user_settings')
      .select('appearance')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!error && (data?.appearance === 'system' || data?.appearance === 'light' || data?.appearance === 'dark')) {
      applyPreference(data.appearance);
      await AsyncStorage.setItem(preferenceKey, data.appearance);
    }
  }, [applyPreference, session, verified]);

  useEffect(() => {
    AsyncStorage.getItem(preferenceKey).then((stored) => {
      if (stored === 'system' || stored === 'light' || stored === 'dark') {
        applyPreference(stored);
      }
    });
  }, [applyPreference]);

  useEffect(() => { void reconcile(); }, [reconcile]);

  useEffect(() => {
    if (!session || !verified) return;
    const supabase = getSupabase();
    const channel = supabase.channel(`appearance-${session.user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'jela_user_settings', filter: `user_id=eq.${session.user.id}`,
      }, () => void reconcile())
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reconcile();
    });
    return () => { appState.remove(); void supabase.removeChannel(channel); };
  }, [reconcile, session, verified]);

  const resolved: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      colors: resolved === 'dark' ? darkPalette : lightPalette,
      setPreference: async (nextPreference) => {
        const previous = preference;
        applyPreference(nextPreference);
        await AsyncStorage.setItem(preferenceKey, nextPreference);
        if (!session || !verified) return;
        const { error } = await getSupabase().from('jela_user_settings').upsert({
          user_id: session.user.id,
          appearance: nextPreference,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) {
          applyPreference(previous);
          await AsyncStorage.setItem(preferenceKey, previous);
          throw error;
        }
      },
    }),
    [applyPreference, preference, resolved, session, verified],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside ThemeProvider.');
  return value;
}
