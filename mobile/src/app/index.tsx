import { Redirect, type Href } from 'expo-router';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { LoadingState } from '@/components/feedback-state';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/contexts/auth-context';

export default function Index() {
  const {
    loading, configured, session, securityLoading, profileComplete,
    adminAccessGranted, account, roles,
  } = useAuth();
  if (session && securityLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (loading) return <AppScreen scroll={false}><LoadingState label="Opening Jela AI…" /></AppScreen>;

  if (!configured) {
    return (
      <AppScreen>
        <BrandMark showPartner />
        <SectionCard title="Backend setup required">
          <AppText>
            This build is safe to open, but it cannot sign in until the Supabase publishable key is supplied through the mobile environment.
          </AppText>
          <AppText tone="muted" variant="caption">
            Copy .env.example to .env, add the project publishable key, then rebuild. Secret service keys must never be added to the app.
          </AppText>
        </SectionCard>
      </AppScreen>
    );
  }

  if (!session) return <Redirect href={'/welcome' as Href} />;
  if (!profileComplete) return <Redirect href={'/(auth)/profile-completion' as Href} />;
  if (account?.status === 'suspended' || account?.status === 'deactivated') {
    return <Redirect href="/(user)/account-blocked" />;
  }
  if (roles.includes('admin') && !adminAccessGranted) return <Redirect href={'/(auth)/admin-access' as Href} />;
  if (roles.includes('admin')) return <Redirect href="/(admin)" />;
  return <Redirect href="/(user)" />;
}
