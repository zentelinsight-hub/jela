import { ExternalLink, Mail } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { openWebsite } from '@/lib/website';

export default function HelpScreen() {
  const { colors } = useAppTheme();
  return (
    <PageScreen title="Help" subtitle="Support and guidance">
      <View style={{ gap: 14 }}>
        <SectionCard title="AI responses">
          <AppText tone="muted">Jela AI can make mistakes. Review important facts and never share passwords, API keys, or highly sensitive personal information in a prompt.</AppText>
        </SectionCard>
        <SectionCard title="Account access">
          <AppText tone="muted">Use “Forgot password?” on the sign-in screen. Suspended or deactivated Jela AI accounts must be reviewed by Zentel Insight support.</AppText>
        </SectionCard>
        <SectionCard title="Official downloads">
          <AppText tone="muted">Install Android updates only from the official Jela AI website. Review the published version and checksum before installation.</AppText>
          <Button variant="secondary" icon={<ExternalLink color={colors.text} size={18} />} onPress={() => void openWebsite('download')}>Open download page</Button>
        </SectionCard>
        <Button icon={<Mail color="#FFFFFF" size={18} />} onPress={() => void openWebsite('contact')}>Contact support</Button>
      </View>
    </PageScreen>
  );
}
