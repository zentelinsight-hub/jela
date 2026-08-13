import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { TextField } from '@/components/text-field';
import { friendlyError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export default function PersonalizationScreen() {
  const [preferredName, setPreferredName] = useState('');
  const [responseStyle, setResponseStyle] = useState('Clear and concise');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data: userData } = await getSupabase().auth.getUser();
      if (!userData.user) return;
      const result = await getSupabase().from('jela_user_settings').select('ai_preferences').eq('user_id', userData.user.id).maybeSingle();
      if (result.error) setError(friendlyError(result.error, 'Personalization could not be loaded.'));
      else {
        const preferences = (result.data?.ai_preferences ?? {}) as Record<string, unknown>;
        setPreferredName(typeof preferences.preferred_name === 'string' ? preferences.preferred_name : '');
        setResponseStyle(typeof preferences.response_style === 'string' ? preferences.response_style : 'Clear and concise');
        setInstructions(typeof preferences.custom_instructions === 'string' ? preferences.custom_instructions : '');
      }
      setLoading(false);
    })();
  }, []);
  const save = async () => {
    setSaving(true); setError(null); setMessage(null);
    try {
      const { data } = await getSupabase().auth.getUser();
      if (!data.user) throw new Error('Sign in to continue.');
      const result = await getSupabase().rpc('set_my_jela_personalization', {
        p_preferred_name: preferredName, p_response_style: responseStyle, p_custom_instructions: instructions,
      });
      if (result.error) throw result.error;
      setMessage('Personalization saved. New conversations will use these preferences.');
    } catch (caught) { setError(friendlyError(caught, 'Personalization could not be saved.')); }
    finally { setSaving(false); }
  };
  return (
    <PageScreen title="Personalization" subtitle="Choose how Jela responds to you">
      {loading ? <LoadingState /> : error && !preferredName && !instructions ? <ErrorState message={error} /> : (
        <View style={{ gap: 16 }}>
          <AppText tone="muted">Your preferences are stored with your account and are applied server-side when compatible with safety rules.</AppText>
          <TextField label="What should Jela call you?" value={preferredName} onChangeText={setPreferredName} maxLength={80} />
          <TextField label="Response style" value={responseStyle} onChangeText={setResponseStyle} maxLength={80} hint="For example: concise, detailed, formal, or friendly." />
          <TextField label="Custom instructions" value={instructions} onChangeText={setInstructions} multiline maxLength={1200} hint={`${instructions.length}/1200`} />
          {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
          {message ? <AppText tone="success" variant="caption">{message}</AppText> : null}
          <Button loading={saving} onPress={() => void save()}>Save personalization</Button>
        </View>
      )}
    </PageScreen>
  );
}
