import { Redirect, Stack, type Href } from 'expo-router';

import { AppScreen } from '@/components/app-screen';
import { EmptyState, LoadingState } from '@/components/feedback-state';
import { useAuth } from '@/contexts/auth-context';

export default function AdminLayout() {
  const { loading, securityLoading, session, verified, profileComplete, isAdmin, adminAccessGranted } = useAuth();
  if (loading) return <AppScreen scroll={false}><LoadingState label="Verifying administrator role…" /></AppScreen>;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (securityLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (!verified) return <Redirect href={'/(auth)/login-verification' as Href} />;
  if (!profileComplete) return <Redirect href={'/(auth)/profile-completion' as Href} />;
  if (!isAdmin) return <AppScreen><EmptyState title="Administrator access required" message="This console uses the server-authoritative Jela AI role. Local app state cannot grant access." /></AppScreen>;
  if (!adminAccessGranted) return <Redirect href={'/(auth)/admin-access' as Href} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
