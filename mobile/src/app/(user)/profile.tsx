import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { PageScreen } from '@/components/page-screen';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { friendlyError } from '@/lib/errors';
import { updateProfile } from '@/services/account';
import { pickAndUploadAvatar, removeAvatar, signedAvatarUrl } from '@/services/avatar';

export default function ProfileScreen() {
  const { user, account, refreshAccount } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
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
    setLoading(true); setError(null);
    try { const path = await pickAndUploadAvatar(user.id); if (path) { await refreshAccount(); setMessage('Profile photo updated.'); } }
    catch (caught) { setError(friendlyError(caught, 'Could not update your profile photo.')); }
    finally { setLoading(false); }
  };

  const clearAvatar = async () => {
    setLoading(true); setError(null);
    try { await removeAvatar(account?.avatar_path ?? null); await refreshAccount(); setAvatarUrl(null); setMessage('Profile photo removed.'); }
    catch (caught) { setError(friendlyError(caught, 'Could not remove your profile photo.')); }
    finally { setLoading(false); }
  };

  const save = async () => {
    if (firstName.trim().length < 2 || lastName.trim().length < 2) { setError('Enter your first and last name.'); return; }
    setLoading(true); setError(null); setMessage(null);
    try {
      await updateProfile({ firstName, lastName, displayName });
      await refreshAccount();
      setMessage('Profile saved.');
    } catch (saveError) { setError(friendlyError(saveError, 'Could not save your profile.')); }
    finally { setLoading(false); }
  };

  return (
    <PageScreen title="Profile" subtitle="Your account details">
      <View style={{ gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <BrandMark compact />
        <View style={{ alignItems: 'center', gap: 10 }}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={{ width: 104, height: 104, borderRadius: 52 }} /> : <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: '#1C1C1C' }} />}
          <View style={{ flexDirection: 'row', gap: 8 }}><Button variant="secondary" loading={loading} onPress={() => void changeAvatar()}>Choose photo</Button>{account?.avatar_path ? <Button variant="ghost" onPress={() => void clearAvatar()}>Remove</Button> : null}</View>
        </View>
        <TextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" hint="Optional name shown inside Jela AI." />
        <TextField label="Email" value={user?.email ?? ''} editable={false} hint="Email changes require a verified account flow and are not available here." />
        {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
        {message ? <AppText tone="success" variant="caption">{message}</AppText> : null}
        <Button loading={loading} onPress={save}>Save profile</Button>
      </View>
    </PageScreen>
  );
}
