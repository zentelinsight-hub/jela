import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PageScreen } from '@/components/page-screen';
import { TextField } from '@/components/text-field';
import { friendlyError } from '@/lib/errors';
import { workspaceService } from '@/services/workspace';

export default function NewProjectScreen() {
  const router = useRouter();
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const create = async () => {
    if (!name.trim()) { setError('Give your project a name.'); return; }
    setSaving(true); setError(null);
    try {
      const result = await workspaceService.createProject({ name, description, instructions });
      router.replace({ pathname: '/(user)/project/[id]', params: { id: result.project.id } } as Href);
    } catch (caught) { setError(friendlyError(caught, 'The project could not be created.')); }
    finally { setSaving(false); }
  };
  return <PageScreen title="New Project" subtitle="Create a focused AI workspace"><View style={{ gap: 16 }}>
    <TextField label="Project name" value={name} onChangeText={setName} maxLength={100} autoCapitalize="sentences" placeholder="My business" />
    <TextField label="Description (optional)" value={description} onChangeText={setDescription} maxLength={1000} multiline autoCapitalize="sentences" />
    <TextField label="Custom instructions (optional)" value={instructions} onChangeText={setInstructions} maxLength={8000} multiline autoCapitalize="sentences" hint="Jela applies these only inside this project." />
    {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}<Button loading={saving} onPress={() => void create()}>Create Project</Button>
  </View></PageScreen>;
}
