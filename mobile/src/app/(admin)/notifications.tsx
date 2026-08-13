import { BellRing, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { TextField } from '@/components/text-field';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { broadcastNotification } from '@/services/admin';

export default function AdminNotificationsScreen() {
  const { colors } = useAppTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!title.trim() || !body.trim()) { setError('Enter both a title and message.'); return; }
    setSending(true); setError(null);
    try {
      const result = await broadcastNotification(title.trim(), body.trim());
      setTitle(''); setBody('');
      Alert.alert('Broadcast sent', `${result.accepted} device${result.accepted === 1 ? '' : 's'} accepted the push. Every account can also read it in the Jela AI inbox.`);
    } catch (caught) { setError(friendlyError(caught, 'The broadcast could not be sent.')); }
    finally { setSending(false); }
  };
  return (
    <PageScreen title="Notifications" subtitle="Administrator broadcast centre">
      <SectionCard>
        <BellRing color={colors.accent} size={34} />
        <AppText variant="title">Notify all users</AppText>
        <AppText tone="muted">Only verified administrators with the current Admin access grant can publish. Messages are saved to every user’s inbox and pushed to devices that granted Android permission.</AppText>
      </SectionCard>
      <View style={{ gap: 14 }}>
        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={80} placeholder="What users should know" />
        <TextField label="Message" value={body} onChangeText={setBody} maxLength={280} multiline placeholder="Write a concise, useful notification." hint={`${body.length}/280`} />
        {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
        <Button fullWidth loading={sending} icon={<Send color="#FFFFFF" size={18} />} onPress={() => void send()}>Send to all users</Button>
      </View>
    </PageScreen>
  );
}
