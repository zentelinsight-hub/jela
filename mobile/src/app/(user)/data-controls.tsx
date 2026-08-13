import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Brain, Database, FileText, Images, MessageSquareText, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { SettingRow } from '@/components/setting-row';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { deleteAccount } from '@/services/security';

export default function DataControlsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { reauthenticated } = useLocalSearchParams<{ reauthenticated?: string }>();
  const { signOut } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = (path: string) => () => router.push(path as Href);

  const verifyDeletion = () => router.push({
    pathname: '/(auth)/login-verification',
    params: { purpose: 'sensitive_action', returnTo: '/(user)/data-controls?reauthenticated=1' },
  } as unknown as Href);
  const remove = async () => {
    if (confirmation !== 'DELETE') { setError('Type DELETE exactly to confirm.'); return; }
    setDeleting(true); setError(null);
    try {
      await deleteAccount(confirmation);
      await signOut().catch(() => undefined);
      router.replace('/welcome' as Href);
    } catch (caught) { setError(friendlyError(caught, 'The account was not deleted.')); }
    finally { setDeleting(false); }
  };

  return (
    <PageScreen title="Data controls" subtitle="Understand and manage your Jela AI data">
      <View style={{ gap: 14 }}>
        <SectionCard>
          <Database color={colors.primary} />
          <AppText variant="title">Your private workspace</AppText>
          <AppText tone="muted">Conversations, Memory, Projects, workspace files, profile, billing, and generated images are scoped to your verified account. AI requests are sent without provider-side response storage.</AppText>
        </SectionCard>
        <SettingRow title="Conversation history" description="Search, rename, or delete individual chats" icon={<MessageSquareText color={colors.textMuted} />} onPress={go('/(user)/history')} />
        <SettingRow title="Memory" description="Edit, pin, forget, or clear persistent memory" icon={<Brain color={colors.textMuted} />} onPress={go('/(user)/memory')} />
        <SettingRow title="Workspace files" description="Review and delete private persistent files" icon={<FileText color={colors.textMuted} />} onPress={go('/(user)/files')} />
        <SettingRow title="My images" description="View and manage generated images" icon={<Images color={colors.textMuted} />} onPress={go('/(user)/images')} />
        <SectionCard title="Delete account permanently">
          <ShieldAlert color={colors.danger} />
          <AppText tone="muted">Deletion cancels active renewal, removes private files and application data, and then deletes the authentication account. This cannot be undone.</AppText>
          {reauthenticated === '1' ? (
            <>
              <TextField label="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} />
              {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
              <Button variant="danger" loading={deleting} disabled={confirmation !== 'DELETE'} onPress={() => void remove()}>Delete my account</Button>
            </>
          ) : <Button variant="danger" onPress={verifyDeletion}>Verify by email before deletion</Button>}
        </SectionCard>
      </View>
    </PageScreen>
  );
}
