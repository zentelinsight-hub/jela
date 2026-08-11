import { BellOff } from 'lucide-react-native';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { AppText } from '@/components/app-text';
import { useFeatures } from '@/contexts/feature-context';
import { useAppTheme } from '@/contexts/theme-context';
export default function NotificationsScreen() { const { flags } = useFeatures(); const { colors } = useAppTheme(); return <PageScreen title="Notifications" subtitle="Server-controlled delivery"><SectionCard><BellOff color={colors.textMuted} /><AppText variant="title">{flags.push_notifications_enabled ? 'Notifications enabled' : 'Not available yet'}</AppText><AppText tone="muted">Jela AI will only offer notification controls after secure device registration is enabled. No placeholder toggle is shown.</AppText></SectionCard></PageScreen>; }
