import * as Linking from 'expo-linking';
import { ExternalLink, Mail } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { appConfig } from '@/lib/config';

export default function HelpScreen() {
  const { colors } = useAppTheme();
  const website = appConfig?.websiteUrl ?? 'https://jela-ai-official.victorudofiah25.chatgpt.site';
  return (
    <PageScreen title="Help" subtitle="Support and guidance">
      <View style={{ gap: 14 }}>
        <SectionCard title="AI responses">
          <AppText tone="muted">Jela AI can make mistakes. Review important facts and never share passwords, API keys, or highly sensitive personal information in a prompt.</AppText>
        </SectionCard>
        <SectionCard title="Account access">
          <AppText tone="muted">Use “Forgot password?” on the sign-in screen. Suspended or disabled accounts must be reviewed by Zentel Insight support.</AppText>
        </SectionCard>
        <SectionCard title="Official downloads">
          <AppText tone="muted">Install Android updates only from the official Jela AI website. Review the published version and checksum before installation.</AppText>
          <Button variant="secondary" icon={<ExternalLink color={colors.text} size={18} />} onPress={() => Linking.openURL(`${website}/download`)}>Open download page</Button>
        </SectionCard>
        <Button icon={<Mail color="#FFFFFF" size={18} />} onPress={() => Linking.openURL('mailto:support@zentelinsight.com?subject=Jela%20AI%20support')}>Email support</Button>
      </View>
    </PageScreen>
  );
}
