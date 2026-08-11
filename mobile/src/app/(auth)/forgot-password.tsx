import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { getSupabase } from '@/lib/supabase';
import { emailSchema } from '@/lib/validation';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Enter a valid email.'); return; }
    setLoading(true); setError(null);
    const result = await getSupabase().auth.resetPasswordForEmail(parsed.data, { redirectTo: Linking.createURL('reset-password') });
    setLoading(false);
    if (result.error) setError(result.error.message);
    else setMessage('If that address belongs to an account, a secure reset link is on its way.');
  };
  return (
    <AppScreen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <AppText variant="headline">Reset your password</AppText>
        <AppText tone="muted">We’ll email a one-time link to the address on your account.</AppText>
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
        {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
        {message ? <AppText tone="success">{message}</AppText> : null}
        <Button fullWidth loading={loading} onPress={submit}>Send reset link</Button>
        <Link href="/(auth)/login" asChild><Button variant="ghost" fullWidth>Back to sign in</Button></Link>
      </View>
    </AppScreen>
  );
}
