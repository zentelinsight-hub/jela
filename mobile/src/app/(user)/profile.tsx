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
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(account?.first_name ?? '');
    setLastName(account?.last_name ?? '');
    setDisplayName(account?.display_name ?? '');
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
    if (firstName.trim().length < 2 || lastName.trim().length < 2) { setError('Enter your first and last name.'); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      await updateProfile({ firstName, lastName, displayName });
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
        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" hint="Optional name shown inside Jela AI." />
        <TextField label="Email" value={user?.email ?? ''} editable={false} hint="Email changes require a verified account flow and are not available here." />
        {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
        {message ? <AppText tone="success" variant="caption">{message}</AppText> : null}
        <Button loading={saving} onPress={save}>Save profile</Button>
      </View>
    </PageScreen>
  );
}
