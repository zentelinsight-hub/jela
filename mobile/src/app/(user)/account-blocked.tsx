import { ShieldAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { accountStatusMessage } from '@/services/account';

export default function AccountBlockedScreen() {
  const { account, signOut } = useAuth();
  const { colors } = useAppTheme();
  return (
    <AppScreen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ShieldAlert color={colors.danger} size={52} />
        <AppText variant="headline" style={{ textAlign: 'center' }}>Account unavailable</AppText>
        <AppText tone="muted" style={{ textAlign: 'center' }}>{accountStatusMessage(account?.status)}</AppText>
        <Button variant="secondary" onPress={signOut}>Sign out</Button>
      </View>
    </AppScreen>
  );
}
