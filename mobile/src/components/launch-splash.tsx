import { useEffect, useState } from 'react';
import { Animated, Image, View } from 'react-native';

import { AppText } from '@/components/app-text';
import jelaIcon from '../../assets/brand/jela-ai-app-icon.png';
import zentelLogo from '../../assets/brand/zentel-insight-logo.jpg';

export function LaunchSplash({ onFinished }: { onFinished: () => void }) {
  const [scale] = useState(() => new Animated.Value(0.94));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 620, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 140, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(onFinished, 1650);
    return () => clearTimeout(timer);
  }, [onFinished, opacity, scale]);

  return (
    <View style={{ position: 'absolute', inset: 0, zIndex: 1000, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ alignItems: 'center', gap: 14, opacity, transform: [{ scale }] }}>
        <Image source={jelaIcon} resizeMode="contain" style={{ width: 132, height: 132, borderRadius: 30 }} />
        <AppText variant="headline" style={{ color: '#FFFFFF' }}>Jela AI</AppText>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: 54, alignItems: 'center', gap: 8 }}>
        <AppText variant="caption" style={{ color: '#A6A6A6' }}>Powered by Zentel Insight</AppText>
        <Image source={zentelLogo} resizeMode="contain" style={{ width: 52, height: 52, borderRadius: 12 }} />
      </View>
    </View>
  );
}
