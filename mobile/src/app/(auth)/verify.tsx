import { Link, useLocalSearchParams } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useAppTheme } from '@/contexts/theme-context';
import { getSupabase } from '@/lib/supabase';

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { colors } = useAppTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const resend = async () => {
    if (!email) return;
    const { error } = await getSupabase().auth.resend({ type: 'signup', email });
    setNotice(error ? 'Could not resend the email yet. Please wait and try again.' : 'A new verification email has been sent.');
  };
  return (
    <AppScreen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <MailCheck color={colors.primary} size={52} />
        <AppText variant="headline" style={{ textAlign: 'center' }}>Check your email</AppText>
        <AppText tone="muted" style={{ textAlign: 'center' }}>Open the verification link sent to {email ?? 'your email address'}, then return to Jela AI.</AppText>
        {notice ? <AppText tone="muted" style={{ textAlign: 'center' }}>{notice}</AppText> : null}
        {email ? <Button variant="secondary" onPress={() => void resend()}>Resend verification email</Button> : null}
        <Link href="/(auth)/login" asChild><Button>Return to sign in</Button></Link>
      </View>
    </AppScreen>
  );
}
