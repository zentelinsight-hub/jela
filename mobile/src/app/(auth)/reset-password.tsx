import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { getSupabase } from '@/lib/supabase';
import { passwordSchema } from '@/lib/validation';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Choose a stronger password.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const result = await getSupabase().auth.updateUser({ password });
    setLoading(false);
    if (result.error) setError(result.error.message);
    else router.replace('/(user)');
  };
  return (
    <AppScreen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <AppText variant="headline">Choose a new password</AppText>
        <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
        {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
        <Button loading={loading} onPress={submit}>Save password</Button>
      </View>
    </AppScreen>
  );
}
