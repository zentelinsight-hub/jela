import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { startEmailChallenge, verifyEmailChallenge } from '@/services/security';
import { radius } from '@/theme/tokens';

export default function LoginVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ purpose?: string; returnTo?: string }>();
  const purpose = params.purpose === 'sensitive_action' ? 'sensitive_action' : 'login';
  const { colors } = useAppTheme();
  const { session, verified, refreshSecurity, signOut } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const started = useRef(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState('your account email');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await startEmailChallenge(purpose);
      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail);
      setCooldown(result.resendIn);
      setTimeout(() => inputRef.current?.focus(), 250);
    } catch (caught) {
      setError(friendlyError(caught, 'The verification code could not be sent.'));
    } finally { setLoading(false); }
  }, [purpose]);

  useEffect(() => {
    if (!session || started.current) return;
    started.current = true;
    void begin();
  }, [begin, session]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (verified && purpose === 'login') return <Redirect href="/" />;

  const submit = async () => {
    if (!challengeId || code.length !== 6) { setError('Enter all 6 digits from your email.'); return; }
    setVerifying(true); setError(null);
    try {
      await verifyEmailChallenge(challengeId, code);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSecurity();
      router.replace((params.returnTo || '/') as Href);
    } catch (caught) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(friendlyError(caught, 'That code could not be verified.'));
    } finally { setVerifying(false); }
  };

  return (
    <AppScreen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', width: '100%', maxWidth: 520, alignSelf: 'center', gap: 22 }}>
        <BrandMark compact />
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.userBubble, alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck color={colors.primary} size={28} />
        </View>
        <View style={{ gap: 7 }}>
          <AppText variant="headline">Verify it’s you</AppText>
          <AppText tone="muted">Enter the 6-digit security code sent to {maskedEmail}. It expires in 10 minutes.</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Enter verification code" onPress={() => inputRef.current?.focus()}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
            {Array.from({ length: 6 }, (_, index) => (
              <View key={index} style={{
                flex: 1, maxWidth: 52, minHeight: 58, borderRadius: radius.md, borderWidth: 1.5,
                borderColor: index === code.length ? colors.primary : colors.border,
                backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
              }}>
                <AppText variant="title">{code[index] ?? ''}</AppText>
              </View>
            ))}
          </View>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          />
        </Pressable>
        {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
        <Button fullWidth loading={verifying || loading} disabled={!challengeId || code.length !== 6} onPress={() => void submit()}>
          Verify and continue
        </Button>
        <Button fullWidth variant="secondary" disabled={loading || cooldown > 0} onPress={() => void begin()}>
          {cooldown > 0 ? `Send another code in ${cooldown}s` : 'Send another code'}
        </Button>
        <Button variant="ghost" onPress={() => void signOut()}>Use a different account</Button>
      </View>
    </AppScreen>
  );
}
