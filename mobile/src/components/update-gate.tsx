import * as Linking from 'expo-linking';
import { Download } from 'lucide-react-native';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { AppState, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchLatestAndroidRelease } from '@/services/releases';
import { radius } from '@/theme/tokens';
import type { AppRelease } from '@/types/database';
import { getSupabase } from '@/lib/supabase';

export function UpdateGate({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const [required, setRequired] = useState<AppRelease | null>(null);

  useEffect(() => {
    if (!session) return;
    const refresh = () => fetchLatestAndroidRelease()
      .then((result) => {
        setRequired(result.state === 'required' && result.release ? result.release : null);
      })
      .catch(() => {
        // A failed update check must not lock users out. Manual retry remains in Settings.
      });
    void refresh();
    const supabase = getSupabase();
    const channel = supabase.channel('current-android-release-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_ai_releases', filter: 'platform=eq.android' }, () => void refresh())
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { appState.remove(); void supabase.removeChannel(channel); };
  }, [session]);

  return (
    <>
      {children}
      <Modal visible={Boolean(required)} animationType="fade" onRequestClose={() => undefined} transparent>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.overlay }}>
          <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 22, alignItems: 'center', gap: 14 }}>
            <Download color={colors.accent} size={46} />
            <AppText variant="headline" style={{ textAlign: 'center' }}>Update required</AppText>
            <AppText tone="muted" style={{ textAlign: 'center' }}>Jela AI {required?.version_name} is required for security and compatibility. Install it only from the official signed download.</AppText>
            {required ? <Button fullWidth onPress={() => Linking.openURL(required.download_url)}>Open official download</Button> : null}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
