import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Image, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';

const images = [
  require('../../assets/welcome/ai-assistance.webp'),
  require('../../assets/welcome/ai-learning.webp'),
  require('../../assets/welcome/ai-network.webp'),
  require('../../assets/welcome/ai-robot.webp'),
  require('../../assets/welcome/ai-strategy.webp'),
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [opacity] = useState(() => new Animated.Value(1));
  const [scale] = useState(() => new Animated.Value(1.04));

  useEffect(() => {
    Animated.timing(scale, { toValue: 1, duration: 4200, useNativeDriver: true }).start();
    const timer = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 520, useNativeDriver: true }).start(() => {
        setIndex((current) => (current + 1) % images.length);
        scale.setValue(1.04);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 720, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 4200, useNativeDriver: true }),
        ]).start();
      });
    }, 4700);
    return () => clearInterval(timer);
  }, [opacity, scale]);

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <Animated.View style={{ position: 'absolute', inset: 0, opacity, transform: [{ scale }] }}>
        <Image source={images[index]} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      </Animated.View>
      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.58)' }} />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 46, gap: 18 }}>
        <View style={{ gap: 8 }}>
          <AppText variant="display" style={{ color: '#FFFFFF' }}>Meet Jela AI</AppText>
          <AppText style={{ color: '#E8E8E8' }}>Thoughtful AI assistance for learning, planning, research, and everyday work.</AppText>
        </View>
        <Button fullWidth onPress={() => router.push('/(auth)/signup')}>Create account</Button>
        <Button fullWidth variant="secondary" onPress={() => router.push('/(auth)/login')}>Log in</Button>
      </View>
    </View>
  );
}
