import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import {
  Bell,
  Download,
  FileUp,
  HelpCircle,
  Info,
  LogOut,
  Moon,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PageScreen } from '@/components/page-screen';
import { SettingRow } from '@/components/setting-row';
import { useAuth } from '@/contexts/auth-context';
import { useFeatures } from '@/contexts/feature-context';
import { useAppTheme } from '@/contexts/theme-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, preference } = useAppTheme();
  const { flags } = useFeatures();
  const { isAdmin, signOut } = useAuth();
  const go = (path: string) => () => router.push(path as Href);
  return (
    <PageScreen title="Settings" subtitle="Jela AI preferences">
      <View style={{ gap: 10 }}>
        <SettingRow title="Profile" description="Names and account email" icon={<UserRound color={colors.textMuted} />} onPress={go('/(user)/profile')} />
        <SettingRow title="Appearance" description="Theme follows your choice across launches" value={preference} icon={<Moon color={colors.textMuted} />} onPress={go('/(user)/appearance')} />
        {flags.attachments_enabled ? <SettingRow title="Attachments" description="Your private uploaded files" icon={<FileUp color={colors.textMuted} />} onPress={go('/(user)/attachments')} /> : null}
        <SettingRow title="App update" description="Check the official Android release" icon={<Download color={colors.textMuted} />} onPress={go('/(user)/update')} />
        <SettingRow title="Notifications" description="Prepared for a future server-controlled rollout" value={flags.push_notifications_enabled ? 'Enabled' : 'Not available'} icon={<Bell color={colors.textMuted} />} />
        <SettingRow title="Help" description="Support and common questions" icon={<HelpCircle color={colors.textMuted} />} onPress={go('/(user)/help')} />
        <SettingRow title="About" description="Version and official brands" icon={<Info color={colors.textMuted} />} onPress={go('/(user)/about')} />
        {isAdmin ? <SettingRow title="Admin console" description="Server-authoritative operations" icon={<ShieldCheck color={colors.accent} />} onPress={go('/(admin)')} /> : null}
        <SettingRow title="Sign out" description="Remove this session from this device" icon={<LogOut color={colors.danger} />} danger onPress={async () => { await signOut(); router.replace('/(auth)/login'); }} />
        <AppText tone="muted" variant="caption" style={{ textAlign: 'center', marginTop: 8 }}>Sensitive authentication data is stored in Android secure storage. Theme preference is the only local app preference.</AppText>
      </View>
    </PageScreen>
  );
}
