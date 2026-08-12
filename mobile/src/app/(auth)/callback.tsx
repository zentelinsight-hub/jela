import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { LoadingState } from '@/components/feedback-state';
import { getSupabase } from '@/lib/supabase';
import { completeGoogleCallback } from '@/services/oauth';

export default function CallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const finish = async () => {
      try {
        if (params.code) {
          await completeGoogleCallback(Linking.createURL('auth/callback', { queryParams: { code: params.code } }));
        }
        const { data } = await getSupabase().auth.getSession();
        if (!data.session) throw new Error('missing_session');
        router.replace('/');
      } catch { setError('Unable to complete Google sign-in. Please try again.'); }
    };
    void finish();
  }, [params.code, router]);
  return <AppScreen scroll={false}>{error ? <AppText tone="danger">{error}</AppText> : <LoadingState label="Logging in…" />}</AppScreen>;
}
