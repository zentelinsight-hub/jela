import { Redirect } from 'expo-router';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { LoadingState } from '@/components/feedback-state';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/contexts/auth-context';

export default function Index() {
  const { loading, configured, session, account } = useAuth();
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

  if (!session) return <Redirect href="/(auth)/login" />;
  if (account?.status === 'suspended' || account?.status === 'disabled') {
    return <Redirect href="/(user)/account-blocked" />;
  }
  return <Redirect href="/(user)" />;
}
