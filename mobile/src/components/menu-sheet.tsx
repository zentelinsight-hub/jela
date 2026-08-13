import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import {
  BadgeDollarSign,
  Bot,
  CircleHelp,
  Clock3,
  Activity,
  CreditCard,
  Brain,
  FileText,
  FolderKanban,
  Images,
  LogOut,
  PlusCircle,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react-native';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';

const userLinks = [
  ['New chat', '/(user)', Bot],
  ['Search', '/(user)/search', Search],
  ['Create', '/(user)/create', PlusCircle],
  ['Projects', '/(user)/projects', FolderKanban],
  ['Recent conversations', '/(user)/history', Clock3],
  ['Files', '/(user)/files', FileText],
  ['Memory', '/(user)/memory', Brain],
  ['Images', '/(user)/images', Images],
  ['Usage', '/(user)/usage', Activity],
  ['Plans', '/(user)/plans', BadgeDollarSign],
  ['Billing', '/(user)/billing', CreditCard],
  ['Profile', '/(user)/profile', UserRound],
  ['Settings', '/(user)/settings', Settings],
  ['Help', '/(user)/help', CircleHelp],
] as const;

export function MenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { isAdmin, signOut } = useAuth();

  const navigate = (path: string) => {
    onClose();
    router.push(path as Href);
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose} transparent>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <SafeAreaView
          edges={['bottom']}
          style={{ maxHeight: '90%', backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}><BrandMark compact /></View>
            <Pressable accessibilityLabel="Close menu" accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <X color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 5 }}>
            {userLinks.map(([label, path, Icon]) => (
              <Pressable
                accessibilityRole="button"
                key={path}
                onPress={() => navigate(path)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13,
                  borderRadius: 14, backgroundColor: pressed ? colors.surfaceElevated : 'transparent',
                })}
              >
                <Icon color={colors.textMuted} size={21} />
                <AppText variant="label">{label}</AppText>
              </Pressable>
            ))}
            {isAdmin ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => navigate('/(admin)')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }}
              >
                <ShieldCheck color={colors.accent} size={21} />
                <AppText variant="label" tone="accent">Admin console</AppText>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={async () => { onClose(); await signOut(); router.replace('/(auth)/login'); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }}
            >
              <LogOut color={colors.danger} size={21} />
              <AppText variant="label" tone="danger">Sign out</AppText>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
