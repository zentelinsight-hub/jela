import { ShieldCheck } from 'lucide-react-native';
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
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (caught) { setError(friendlyError(caught, 'Your password could not be changed.')); }
    finally { setLoading(false); }
  };

  return (
    <PageScreen title="Account & security" subtitle="Credentials and account access">
      <View style={{ gap: 14 }}>
        <SectionCard>
          <ShieldCheck color={colors.success} />
          <AppText variant="title">Secure sign-in</AppText>
          <AppText tone="muted">Your authenticated session is stored securely on this device. No email code is required after signing in.</AppText>
        </SectionCard>
        <SectionCard title="Account email">
          <AppText>{user?.email ?? 'No email available'}</AppText>
          <AppText tone="muted" variant="caption">Email changes require a separate verified support workflow.</AppText>
        </SectionCard>
        <SectionCard title="Change password">
          <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <TextField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" />
          {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
          {message ? <AppText tone="success" variant="caption">{message}</AppText> : null}
          <Button loading={loading} onPress={() => void changePassword()}>Save new password</Button>
        </SectionCard>
      </View>
    </PageScreen>
  );
}
