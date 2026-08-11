import { Redirect, Stack, useSegments } from 'expo-router';

import { AppScreen } from '@/components/app-screen';
import { LoadingState } from '@/components/feedback-state';
import { useAuth } from '@/contexts/auth-context';

export default function AuthLayout() {
  const { loading, session } = useAuth();
  const segments = useSegments();
  if (loading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (session && !segments.includes('reset-password')) return <Redirect href="/(user)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
