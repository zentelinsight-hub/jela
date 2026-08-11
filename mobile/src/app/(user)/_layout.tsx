import { Redirect, Stack } from 'expo-router';

import { AppScreen } from '@/components/app-screen';
import { LoadingState } from '@/components/feedback-state';
import { useAuth } from '@/contexts/auth-context';

export default function UserLayout() {
  const { loading, session } = useAuth();
  if (loading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (!session) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
