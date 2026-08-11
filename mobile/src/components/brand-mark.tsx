import { Image, View } from 'react-native';

import { AppText } from '@/components/app-text';
import jelaLogo from '../../assets/brand/jela-ai-logo.png';
import zentelLogo from '../../assets/brand/zentel-insight-logo.jpg';

type Props = { compact?: boolean; showPartner?: boolean };

export function BrandMark({ compact = false, showPartner = false }: Props) {
  return (
    <View style={{ alignItems: compact ? 'flex-start' : 'center', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Image
          accessibilityLabel="Jela AI logo"
          resizeMode="contain"
          source={jelaLogo}
          style={{ width: compact ? 42 : 82, height: compact ? 42 : 82, borderRadius: 12 }}
        />
        <AppText variant={compact ? 'title' : 'headline'}>Jela AI</AppText>
      </View>
      {showPartner ? (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <AppText tone="muted" variant="caption">A Zentel Insight product</AppText>
          <Image
            accessibilityLabel="Zentel Insight logo"
            resizeMode="contain"
            source={zentelLogo}
            style={{ width: 150, height: 54 }}
          />
        </View>
      ) : null}
    </View>
  );
}
