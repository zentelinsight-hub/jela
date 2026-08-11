import { Link, useLocalSearchParams } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useAppTheme } from '@/contexts/theme-context';

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { colors } = useAppTheme();
  return (
    <AppScreen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <MailCheck color={colors.primary} size={52} />
        <AppText variant="headline" style={{ textAlign: 'center' }}>Check your email</AppText>
        <AppText tone="muted" style={{ textAlign: 'center' }}>Open the verification link sent to {email ?? 'your email address'}, then return to Jela AI.</AppText>
        <Link href="/(auth)/login" asChild><Button>Return to sign in</Button></Link>
      </View>
    </AppScreen>
  );
}
