import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { PageScreen } from '@/components/page-screen';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { friendlyError } from '@/lib/errors';
import { updateProfile } from '@/services/account';
import { pickAvatar, removeAvatar, signedAvatarUrl, uploadAvatarVersion } from '@/services/avatar';

export default function ProfileScreen() {
  const { user, account, refreshAccount } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'prefer_not_to_say' | ''>('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(account?.first_name ?? '');
    setLastName(account?.last_name ?? '');
    setAge(account?.age ? String(account.age) : '');
    setGender(account?.gender ?? '');
  }, [account]);

  useEffect(() => { void signedAvatarUrl(account?.avatar_path ?? null).then(setAvatarUrl).catch(() => setAvatarUrl(null)); }, [account?.avatar_path]);

  const changeAvatar = async () => {
    if (!user) return;
    setError(null); setMessage(null);
    const previousUrl = avatarUrl;
    try {
      const localUri = await pickAvatar();
      if (!localUri) return;
      setAvatarUrl(localUri);
      setAvatarBusy(true);
      const uploaded = await uploadAvatarVersion(user.id, localUri, account?.avatar_path ?? null);
      setAvatarUrl(uploaded.signedUrl);
      await refreshAccount();
      setMessage('Profile photo updated.');
    }
    catch (caught) { setAvatarUrl(previousUrl); setError(friendlyError(caught, 'Could not update your profile photo.')); }
    finally { setAvatarBusy(false); }
  };

  const clearAvatar = async () => {
    const previousUrl = avatarUrl;
    setAvatarBusy(true); setError(null); setMessage(null); setAvatarUrl(null);
    try { await removeAvatar(account?.avatar_path ?? null); await refreshAccount(); setMessage('Profile photo removed.'); }
    catch (caught) { setAvatarUrl(previousUrl); setError(friendlyError(caught, 'Could not remove your profile photo.')); }
    finally { setAvatarBusy(false); }
  };

  const save = async () => {
    const parsedAge = Number(age);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) { setError('Enter your first and last name.'); return; }
    if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) { setError('Enter an age between 13 and 120.'); return; }
    if (!gender) { setError('Select your gender.'); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      await updateProfile({ firstName, lastName, age: parsedAge, gender });
      await refreshAccount();
      setMessage('Profile saved.');
    } catch (saveError) { setError(friendlyError(saveError, 'Could not save your profile.')); }
    finally { setSaving(false); }
  };

  return (
    <PageScreen title="Profile" subtitle="Your account details">
      <View style={{ gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <BrandMark compact />
        <View style={{ alignItems: 'center', gap: 10 }}>
          <View>{avatarUrl ? <Image source={{ uri: avatarUrl }} style={{ width: 104, height: 104, borderRadius: 52 }} /> : <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: '#1C1C1C' }} />}{avatarBusy ? <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 52, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#FFFFFF" /></View> : null}</View>
          <View style={{ flexDirection: 'row', gap: 8 }}><Button variant="secondary" disabled={avatarBusy} onPress={() => void changeAvatar()}>Choose photo</Button>{account?.avatar_path || avatarUrl ? <Button variant="ghost" disabled={avatarBusy} onPress={() => void clearAvatar()}>Remove</Button> : null}</View>
        </View>
        <TextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        <TextField label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} />
        <AppText variant="label">Gender</AppText>
        <View style={{ gap: 8 }}>
          <Button fullWidth variant={gender === 'male' ? 'primary' : 'secondary'} onPress={() => setGender('male')}>Male</Button>
          <Button fullWidth variant={gender === 'female' ? 'primary' : 'secondary'} onPress={() => setGender('female')}>Female</Button>
          <Button fullWidth variant={gender === 'prefer_not_to_say' ? 'primary' : 'secondary'} onPress={() => setGender('prefer_not_to_say')}>Prefer not to say</Button>
        </View>
        <TextField label="Email" value={user?.email ?? ''} editable={false} hint="Email changes require a verified account flow and are not available here." />
        {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
        {message ? <AppText tone="success" variant="caption">{message}</AppText> : null}
        <Button loading={saving} onPress={save}>Save profile</Button>
      </View>
    </PageScreen>
  );
}
