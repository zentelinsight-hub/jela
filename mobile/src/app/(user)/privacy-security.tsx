import { ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
export default function PrivacySecurityScreen() { const { colors } = useAppTheme(); return <PageScreen title="Privacy & security" subtitle="How Jela protects this app"><View style={{ gap: 12 }}><SectionCard><ShieldCheck color={colors.success} /><AppText variant="title">Secure by design</AppText><AppText tone="muted">Sessions use Android secure storage. AI provider and payment secrets stay on Jela AI servers. Payment callbacks are verified before any plan is activated.</AppText></SectionCard><SectionCard title="Private profile media"><AppText tone="muted">Avatars are stored in a private bucket and delivered with short-lived signed links.</AppText></SectionCard></View></PageScreen>; }
