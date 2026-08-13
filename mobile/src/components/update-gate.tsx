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
import { openWebsite } from '@/lib/website';

export function UpdateGate({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [required, setRequired] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const refresh = () => fetchLatestAndroidRelease()
      .then((result) => {
        const available = result.state !== 'current' && result.release ? result.release : null;
        setRelease(available && (result.state === 'required' || available.version_name !== dismissedVersion) ? available : null);
        setRequired(result.state === 'required');
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
  }, [dismissedVersion, session]);

  return (
    <>
      {children}
      <Modal visible={Boolean(release)} animationType="fade" onRequestClose={() => { if (!required && release) { setDismissedVersion(release.version_name); setRelease(null); } }} transparent>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.overlay }}>
          <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 22, alignItems: 'center', gap: 14 }}>
            <Download color={colors.accent} size={46} />
            <AppText variant="headline" style={{ textAlign: 'center' }}>{required ? 'Update required' : 'A new Jela AI update is ready'}</AppText>
            <AppText tone="muted" style={{ textAlign: 'center' }}>Jela AI {release?.version_name} includes the latest features and improvements. Download it from the official Jela AI website.</AppText>
            {release ? <Button fullWidth onPress={() => void openWebsite('download')}>Update Jela AI</Button> : null}
            {!required && release ? <Button fullWidth variant="ghost" onPress={() => { setDismissedVersion(release.version_name); setRelease(null); }}>Later</Button> : null}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
