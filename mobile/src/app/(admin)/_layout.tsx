import { Redirect, Stack } from 'expo-router';

import { AppScreen } from '@/components/app-screen';
import { EmptyState, LoadingState } from '@/components/feedback-state';
import { useAuth } from '@/contexts/auth-context';

export default function AdminLayout() {
  const { loading, session, isAdmin } = useAuth();
  if (loading) return <AppScreen scroll={false}><LoadingState label="Verifying administrator role…" /></AppScreen>;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!isAdmin) return <AppScreen><EmptyState title="Administrator access required" message="This console uses the server-authoritative Jela AI role. Local app state cannot grant access." /></AppScreen>;
  return <Stack screenOptions={{ headerShown: false }} />;
}
