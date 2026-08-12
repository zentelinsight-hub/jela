import * as Application from 'expo-application';
import { ExternalLink } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { openWebsite } from '@/lib/website';

export default function AboutScreen() {
  const { colors } = useAppTheme();
  return (
    <PageScreen title="About" subtitle="Jela AI for Android">
      <View style={{ alignItems: 'center', gap: 18 }}>
        <BrandMark showPartner />
        <SectionCard title="Think clearly. Move forward.">
          <AppText tone="muted">Jela AI is a native Android assistant from Zentel Insight, built around secure accounts, persistent conversation history, and server-authoritative AI access.</AppText>
          <AppText variant="caption" tone="muted">Version {Application.nativeApplicationVersion ?? '1.0.0'} · code {Application.nativeBuildVersion ?? '1'}</AppText>
        </SectionCard>
        <Button variant="secondary" icon={<ExternalLink color={colors.text} size={18} />} onPress={() => void openWebsite('website')}>Visit Jela AI website</Button>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Button variant="ghost" onPress={() => void openWebsite('privacy')}>Privacy</Button>
          <Button variant="ghost" onPress={() => void openWebsite('terms')}>Terms</Button>
        </View>
      </View>
    </PageScreen>
  );
}
