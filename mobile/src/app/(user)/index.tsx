import { ChatScreen } from '@/components/chat-screen';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';

export default function HomeScreen() {
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => subscription.remove();
  }, []));

  return <ChatScreen />;
}
