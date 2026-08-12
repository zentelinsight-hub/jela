import { Link } from 'expo-router';
import { View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { openWebsite } from '@/lib/website';

export default function ForgotPasswordScreen() {
  return <AppScreen><View style={{ flex: 1, justifyContent: 'center', gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
    <AppText variant="headline">Reset your password</AppText>
    <AppText tone="muted">Password recovery continues securely on the official Jela AI website.</AppText>
    <Button fullWidth onPress={() => void openWebsite('forgotPassword')}>Open password recovery</Button>
    <Link href="/(auth)/login" asChild><Button variant="ghost" fullWidth>Back to sign in</Button></Link>
  </View></AppScreen>;
}
