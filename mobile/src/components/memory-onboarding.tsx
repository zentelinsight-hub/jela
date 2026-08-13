import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Brain } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Switch, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { workspaceService } from '@/services/workspace';
import { radius } from '@/theme/tokens';

export function MemoryOnboarding() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session, verified, profileComplete } = useAuth();
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!session || !verified || !profileComplete) { setVisible(false); return; }
    let active = true;
    void workspaceService.memorySettings().then(({ settings }) => { if (active && settings.onboarded !== true) { setRemember(settings.remember_useful !== false); setVisible(true); } }).catch(() => undefined);
    return () => { active = false; };
  }, [profileComplete, session, verified]);
  const save = async (enabled: boolean) => {
    setSaving(true);
    try {
      await workspaceService.memorySettings({ enabled, rememberUseful: enabled, referenceConversations: enabled, projectMemory: enabled, onboarded: true });
      setVisible(false);
    } finally { setSaving(false); }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}><View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 }}><View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 15 }}><Brain color={colors.primary} size={34} /><AppText variant="headline">Make Jela more personal</AppText><AppText tone="muted">Jela can remember selected useful details so you do not have to repeat yourself. You can edit, turn off, or clear Memory at any time.</AppText><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><AppText style={{ flex: 1 }} variant="label">Remember useful information</AppText><Switch accessibilityLabel="Remember useful information" value={remember} onValueChange={setRemember} trackColor={{ true: colors.primary }} /></View><Button loading={saving} onPress={() => void save(remember)}>Continue</Button><Button variant="secondary" disabled={saving} onPress={() => void save(false)}>Not now</Button><Button variant="ghost" disabled={saving} onPress={() => { setVisible(false); router.push('/(user)/memory-settings' as Href); }}>Learn about Memory</Button></View></View></Modal>;
}
