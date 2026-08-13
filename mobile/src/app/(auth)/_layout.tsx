import { Redirect, Stack, useSegments } from 'expo-router';

import { AppScreen } from '@/components/app-screen';
import { LoadingState } from '@/components/feedback-state';
import { useAuth } from '@/contexts/auth-context';

export default function AuthLayout() {
  const { loading, session } = useAuth();
  const segments = useSegments();
  if (loading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  const isResetPassword = (segments as string[]).includes('reset-password');
  const allowedWithSession = ['profile-completion', 'admin-access', 'reset-password']
    .some((route) => (segments as string[]).includes(route));
  if (session && !isResetPassword && !allowedWithSession) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
