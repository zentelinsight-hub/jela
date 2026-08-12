import { Link, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { appConfig } from '@/lib/config';
import { authErrorMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { emailSchema } from '@/lib/validation';
import { useAppTheme } from '@/contexts/theme-context';
import { continueWithGoogle } from '@/services/oauth';
import { openWebsite } from '@/lib/website';

const GoogleMark = () => <AppText style={{ color: '#4285F4', fontWeight: '800' }}>G</AppText>;

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success || !password) {
      setError(parsedEmail.success ? 'Enter your password.' : parsedEmail.error.issues[0]?.message);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getSupabase().auth.signInWithPassword({ email: parsedEmail.data, password });
    setLoading(false);
    if (result.error) setError(authErrorMessage(result.error, 'Sign-in failed. Check your details and try again.'));
    else router.replace('/');
  };

  const googleSignIn = async () => {
    setGoogleLoading(true); setError(null);
    try { await continueWithGoogle(); router.replace('/'); }
    catch (caught) { setError(authErrorMessage(caught instanceof Error ? caught : null, 'Unable to sign in with Google. Please try again.')); }
    finally { setGoogleLoading(false); }
  };

  return (
    <AppScreen scroll={false}>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.replace('/welcome' as Href)}><ChevronLeft color={colors.text} /></Pressable>
          <BrandMark />
          <View style={{ gap: 5 }}>
            <AppText variant="headline">Welcome back</AppText>
            <AppText tone="muted">Sign in to continue your conversations.</AppText>
          </View>
          <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@domain.com" keyboardType="email-address" autoComplete="email" />
          <TextField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry autoComplete="current-password" />
          {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
          <Button fullWidth loading={loading} onPress={signIn}>{loading ? 'Logging in…' : 'Log in'}</Button>
          <Button variant="ghost" fullWidth onPress={() => void openWebsite('forgotPassword')}>Forgot password?</Button>
          {appConfig?.enableGoogleAuth ? <Button accessibilityLabel="Continue with Google" variant="secondary" fullWidth icon={<GoogleMark />} loading={googleLoading} onPress={() => void googleSignIn()}>Continue with Google</Button> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            <AppText tone="muted">New to Jela AI?</AppText>
            <Link href="/(auth)/signup"><AppText tone="success" variant="label">Create an account</AppText></Link>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
