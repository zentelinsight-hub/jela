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
import { getSupabase } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/errors';
import { firstIssue, signUpSchema } from '@/lib/validation';
import { appConfig } from '@/lib/config';
import { useAppTheme } from '@/contexts/theme-context';
import { continueWithGoogle } from '@/services/oauth';
import { websiteUrl } from '@/lib/website';

const GoogleMark = () => <AppText style={{ color: '#4285F4', fontWeight: '800' }}>G</AppText>;

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const signUp = async () => {
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) { setError(firstIssue(parsed.error)); return; }
    setLoading(true);
    setError(null);
    const { data, error: signUpError } = await getSupabase().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: websiteUrl('emailVerified'),
        data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
      },
    });
    setLoading(false);
    if (signUpError) setError(authErrorMessage(signUpError, 'Account creation failed. Check your details and try again.'));
    else if (data.session) router.replace('/(auth)/login-verification' as Href);
    else router.replace({ pathname: '/(auth)/verify', params: { email: parsed.data.email } });
  };
  const googleSignUp = async () => {
    setGoogleLoading(true); setError(null);
    try { await continueWithGoogle(); router.replace('/(auth)/login-verification' as Href); }
    catch (caught) { setError(authErrorMessage(caught instanceof Error ? caught : null, 'Unable to continue with Google. Please try again.')); }
    finally { setGoogleLoading(false); }
  };

  return (
    <AppScreen scroll={false}>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled"><View style={{ gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.replace('/welcome' as Href)}><ChevronLeft color={colors.text} /></Pressable>
        <BrandMark compact />
        <View><AppText variant="headline">Create your account</AppText><AppText tone="muted">Your Jela AI work stays connected across sessions.</AppText></View>
        <TextField label="First name" value={form.firstName} onChangeText={update('firstName')} autoCapitalize="words" autoComplete="given-name" />
        <TextField label="Last name" value={form.lastName} onChangeText={update('lastName')} autoCapitalize="words" autoComplete="family-name" />
        <TextField label="Email" value={form.email} onChangeText={update('email')} keyboardType="email-address" autoComplete="email" />
        <TextField label="Password" value={form.password} onChangeText={update('password')} secureTextEntry autoComplete="new-password" hint="At least 8 characters with uppercase, lowercase, and a number." />
        <TextField label="Confirm password" value={form.confirmPassword} onChangeText={update('confirmPassword')} secureTextEntry autoComplete="new-password" />
        {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
        <Button fullWidth loading={loading} onPress={signUp}>Create account</Button>
        {appConfig?.enableGoogleAuth ? <Button accessibilityLabel="Continue with Google" variant="secondary" fullWidth icon={<GoogleMark />} loading={googleLoading} onPress={() => void googleSignUp()}>Continue with Google</Button> : null}
        <Link href="/(auth)/login" asChild><Button fullWidth variant="ghost">Back to sign in</Button></Link>
      </View></KeyboardAwareScrollView>
    </AppScreen>
  );
}
