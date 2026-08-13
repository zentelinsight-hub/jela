import * as Haptics from 'expo-haptics';
import { Redirect, useRouter, type Href } from 'expo-router';
import { UserRoundCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { isUsernameAvailable, updateProfile } from '@/services/account';
import { signedAvatarUrl } from '@/services/avatar';
import { setGoogleAccountPassword } from '@/services/security';

export default function ProfileCompletionScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session, user, verified, profileComplete, account, refreshAccount, refreshSecurity } = useAuth();
  const hydrated = useRef(false);
  const [form, setForm] = useState({
    firstName: account?.first_name ?? '', lastName: account?.last_name ?? '', displayName: account?.display_name ?? '',
    username: account?.username ?? '', age: account?.age ? String(account.age) : '', password: '', confirmPassword: '',
  });
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (hydrated.current || !account || !user) return;
    const metadata = user.user_metadata ?? {};
    const fullName = String(metadata.full_name ?? metadata.name ?? '').trim();
    const firstName = account.first_name || String(metadata.given_name ?? metadata.first_name ?? fullName.split(/\s+/)[0] ?? '').trim();
    const lastName = account.last_name || String(metadata.family_name ?? metadata.last_name ?? fullName.split(/\s+/).slice(1).join(' ')).trim();
    setForm({
      firstName,
      lastName,
      displayName: account.display_name || fullName,
      username: account.username ?? '',
      age: account.age ? String(account.age) : '',
      password: '',
      confirmPassword: '',
    });
    hydrated.current = true;
  }, [account, user]);

  useEffect(() => {
    setAvatarLoading(true);
    const googlePhoto = account?.avatar_url
      ?? (typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null)
      ?? (typeof user?.user_metadata?.picture === 'string' ? user.user_metadata.picture : null);
    void signedAvatarUrl(account?.avatar_path ?? null)
      .then((signed) => setAvatarUrl(signed ?? googlePhoto))
      .catch(() => setAvatarUrl(googlePhoto))
      .finally(() => setAvatarLoading(false));
  }, [account?.avatar_path, account?.avatar_url, user?.user_metadata?.avatar_url, user?.user_metadata?.picture]);

  useEffect(() => {
    const username = form.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) { setAvailability('idle'); return; }
    setAvailability('checking');
    const timer = setTimeout(() => void isUsernameAvailable(username)
      .then((available) => setAvailability(available ? 'available' : 'unavailable'))
      .catch(() => setAvailability('idle')), 450);
    return () => clearTimeout(timer);
  }, [form.username]);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!verified) return <Redirect href={'/(auth)/login-verification' as Href} />;
  if (profileComplete) return <Redirect href="/" />;

  const save = async () => {
    const age = Number(form.age);
    const username = form.username.trim().toLowerCase();
    if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) { setError('Enter your first and last name.'); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(username)) { setError('Use 3–30 lowercase letters, numbers, or underscores for your username.'); return; }
    if (availability === 'unavailable') { setError('That username is already taken.'); return; }
    if (!Number.isInteger(age) || age < 13 || age > 120) { setError('Enter an age between 13 and 120.'); return; }
    const needsPassword = Boolean(account?.google_identity && !account?.password_set_at);
    if (needsPassword && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/.test(form.password)) {
      setError('Use 8–72 password characters with an uppercase letter, lowercase letter, and number.'); return;
    }
    if (needsPassword && form.password !== form.confirmPassword) { setError('Your passwords do not match.'); return; }
    setSaving(true); setError(null);
    try {
      if (needsPassword) await setGoogleAccountPassword(form.password);
      await updateProfile({ ...form, username, age });
      await Promise.all([refreshAccount(), refreshSecurity()]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (caught) {
      setError(friendlyError(caught, 'Your profile could not be completed.'));
    } finally { setSaving(false); }
  };

  return (
    <AppScreen scroll={false}>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 16, width: '100%', maxWidth: 540, alignSelf: 'center' }}>
          <BrandMark compact />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <UserRoundCheck color={colors.primary} size={28} />
            <View style={{ flex: 1 }}><AppText variant="headline">Complete your profile</AppText><AppText tone="muted">These details keep your account personal and secure.</AppText></View>
          </View>
          <View style={{ alignItems: 'center', gap: 9, paddingVertical: 4 }}>
            <View style={{ width: 104, height: 104, borderRadius: 52, overflow: 'hidden', backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
              {avatarUrl ? <Image source={{ uri: avatarUrl }} style={{ width: 104, height: 104 }} resizeMode="cover" /> : <UserRoundCheck color={colors.textMuted} size={42} />}
              {avatarLoading ? <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay }}><ActivityIndicator color="#FFFFFF" /></View> : null}
            </View>
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
              {avatarUrl ? 'Profile photo imported from your Google account. You can change it later in Profile.' : 'You can add a profile photo later in Profile.'}
            </AppText>
          </View>
          <TextField label="First name" value={form.firstName} onChangeText={update('firstName')} autoCapitalize="words" />
          <TextField label="Last name" value={form.lastName} onChangeText={update('lastName')} autoCapitalize="words" />
          <TextField label="Display name" value={form.displayName} onChangeText={update('displayName')} autoCapitalize="words" hint="Optional name shown inside Jela AI." />
          <TextField
            label="Username" value={form.username} onChangeText={(value) => update('username')(value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            autoCapitalize="none" autoCorrect={false}
            error={availability === 'unavailable' ? 'That username is already taken.' : null}
            hint={availability === 'checking' ? 'Checking availability…' : availability === 'available' ? 'Username is available.' : '3–30 lowercase letters, numbers, or underscores.'}
          />
          <TextField label="Age" value={form.age} onChangeText={update('age')} keyboardType="number-pad" maxLength={3} />
          {account?.google_identity && !account?.password_set_at ? (
            <>
              <TextField label="Create password" value={form.password} onChangeText={update('password')} secureTextEntry autoCapitalize="none" autoCorrect={false} hint="8–72 characters with uppercase, lowercase, and a number." />
              <TextField label="Confirm password" value={form.confirmPassword} onChangeText={update('confirmPassword')} secureTextEntry autoCapitalize="none" autoCorrect={false} />
            </>
          ) : null}
          <AppText tone="muted" variant="caption">First name, last name, username, age, and Google-account password setup are required before Chat can open.</AppText>
          {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
          <Button fullWidth loading={saving} onPress={() => void save()}>Save and continue</Button>
        </View>
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
