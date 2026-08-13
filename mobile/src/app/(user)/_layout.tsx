import { Redirect, Stack, type Href } from 'expo-router';

import { AppScreen } from '@/components/app-screen';
import { LoadingState } from '@/components/feedback-state';
import { useAuth } from '@/contexts/auth-context';

export default function UserLayout() {
  const { loading, securityLoading, session, profileComplete } = useAuth();
  if (loading || securityLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profileComplete) return <Redirect href={'/(auth)/profile-completion' as Href} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
