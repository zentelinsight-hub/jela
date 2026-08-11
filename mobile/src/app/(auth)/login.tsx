import { Link, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { appConfig } from '@/lib/config';
import { authErrorMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { emailSchema } from '@/lib/validation';

void WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
    else router.replace('/(user)');
  };

  const socialSignIn = async (provider: 'google' | 'github') => {
    const redirectTo = Linking.createURL('callback');
    const { data, error: oauthError } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (oauthError || !data.url) {
      setError(authErrorMessage(oauthError, 'Could not open the identity provider.'));
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') await Linking.openURL(result.url);
  };

  return (
    <AppScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          <BrandMark showPartner />
          <View style={{ gap: 5 }}>
            <AppText variant="headline">Welcome back</AppText>
            <AppText tone="muted">Sign in to continue your conversations.</AppText>
          </View>
          <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@domain.com" keyboardType="email-address" autoComplete="email" />
          <TextField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry autoComplete="current-password" />
          {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
          <Button fullWidth loading={loading} onPress={signIn}>Sign in</Button>
          <Link href="/(auth)/forgot-password" asChild>
            <Button variant="ghost" fullWidth>Forgot password?</Button>
          </Link>
          {appConfig?.enableGoogleAuth ? <Button variant="secondary" fullWidth onPress={() => socialSignIn('google')}>Continue with Google</Button> : null}
          {appConfig?.enableGitHubAuth ? <Button variant="secondary" fullWidth onPress={() => socialSignIn('github')}>Continue with GitHub</Button> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            <AppText tone="muted">New to Jela AI?</AppText>
            <Link href="/(auth)/signup"><AppText tone="success" variant="label">Create an account</AppText></Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
