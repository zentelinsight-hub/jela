import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export default function AccountSecurityScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { reauthenticated } = useLocalSearchParams<{ reauthenticated?: string }>();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = () => router.push({
    pathname: '/(auth)/login-verification',
    params: { purpose: 'sensitive_action', returnTo: '/(user)/account-security?reauthenticated=1' },
  } as unknown as Href);
  const changePassword = async () => {
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError('Use at least 8 characters with uppercase, lowercase, and a number.'); return;
    }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    setLoading(true); setError(null); setMessage(null);
    try {
      const result = await getSupabase().auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword(''); setConfirmPassword(''); setMessage('Password changed successfully.');
      router.setParams({ reauthenticated: undefined });
    } catch (caught) { setError(friendlyError(caught, 'Your password could not be changed.')); }
    finally { setLoading(false); }
  };

  return (
    <PageScreen title="Account & security" subtitle="Credentials and verified access">
      <View style={{ gap: 14 }}>
        <SectionCard>
          <ShieldCheck color={colors.success} />
          <AppText variant="title">Two-step sign-in is active</AppText>
          <AppText tone="muted">Every password or Google sign-in is followed by a 6-digit email code tied to that session.</AppText>
        </SectionCard>
        <SectionCard title="Account email">
          <AppText>{user?.email ?? 'No email available'}</AppText>
          <AppText tone="muted" variant="caption">Email changes require a separate verified support workflow.</AppText>
        </SectionCard>
        <SectionCard title="Change password">
          {reauthenticated === '1' ? (
            <>
              <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
              <TextField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" />
              {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
              {message ? <AppText tone="success" variant="caption">{message}</AppText> : null}
              <Button loading={loading} onPress={() => void changePassword()}>Save new password</Button>
            </>
          ) : (
            <Button icon={<KeyRound color="#FFFFFF" size={18} />} onPress={verify}>Verify by email to continue</Button>
          )}
        </SectionCard>
      </View>
    </PageScreen>
  );
}
