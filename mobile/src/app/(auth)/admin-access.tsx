import * as Haptics from 'expo-haptics';
import { Redirect, useRouter, type Href } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { grantAdminAccess } from '@/services/security';

export default function AdminAccessScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session, verified, profileComplete, isAdmin, adminAccessGranted, refreshSecurity, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!verified) return <Redirect href={'/(auth)/login-verification' as Href} />;
  if (!profileComplete) return <Redirect href={'/(auth)/profile-completion' as Href} />;
  if (!isAdmin) return <Redirect href="/(user)" />;
  if (adminAccessGranted) return <Redirect href="/(admin)" />;

  const unlock = async () => {
    if (!code) { setError('Enter the administrator access code.'); return; }
    setLoading(true); setError(null);
    try {
      await grantAdminAccess(code);
      await refreshSecurity();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(admin)');
    } catch (caught) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(friendlyError(caught, 'Administrator access was not granted.'));
    } finally { setLoading(false); }
  };

  return (
    <AppScreen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', width: '100%', maxWidth: 520, alignSelf: 'center', gap: 18 }}>
        <BrandMark compact />
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.userBubble, alignItems: 'center', justifyContent: 'center' }}>
          <LockKeyhole color={colors.primary} size={27} />
        </View>
        <View style={{ gap: 6 }}><AppText variant="headline">Administrator access</AppText><AppText tone="muted">Your email session is verified. Enter the private administrator code to open the console.</AppText></View>
        <TextField label="Access code" value={code} onChangeText={setCode} secureTextEntry autoComplete="off" autoCorrect={false} />
        {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
        <Button fullWidth loading={loading} onPress={() => void unlock()}>Open Admin Console</Button>
        <Button variant="ghost" onPress={() => void signOut()}>Sign out</Button>
      </View>
    </AppScreen>
  );
}
