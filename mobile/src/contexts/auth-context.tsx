import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { hasConfiguredBackend } from '@/lib/config';
import { authErrorMessage, friendlyError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { fetchAccount, type AccountSnapshot } from '@/services/account';

type AuthContextValue = {
  loading: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  account: AccountSnapshot['profile'];
  roles: AccountSnapshot['roles'];
  isAdmin: boolean;
  error: string | null;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function extractTokens(url: string) {
  const normalized = url.replace('#', '?');
  const parsed = new URL(normalized);
  return {
    accessToken: parsed.searchParams.get('access_token'),
    refreshToken: parsed.searchParams.get('refresh_token'),
    code: parsed.searchParams.get('code'),
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [snapshot, setSnapshot] = useState<AccountSnapshot>({ profile: null, roles: [] });
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async (user: User | null) => {
    if (!user) {
      setSnapshot({ profile: null, roles: [] });
      return;
    }
    try {
      setSnapshot(await fetchAccount(user));
      setError(null);
    } catch (accountError) {
      setError(friendlyError(accountError, 'Could not load this account.'));
    }
  }, []);

  useEffect(() => {
    if (!hasConfiguredBackend) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (sessionError) setError(authErrorMessage(sessionError, 'Could not restore your session. Sign in again.'));
      setSession(data.session);
      await loadAccount(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadAccount(nextSession?.user ?? null);
    });

    const handleUrl = async ({ url }: { url: string }) => {
      const { accessToken, refreshToken, code } = extractTokens(url);
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      } else if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
    };
    const urlListener = Linking.addEventListener('url', (event) => void handleUrl(event));
    Linking.getInitialURL().then((url) => url && void handleUrl({ url }));

    return () => {
      listener.subscription.unsubscribe();
      urlListener.remove();
    };
  }, [loadAccount]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      configured: hasConfiguredBackend,
      session,
      user: session?.user ?? null,
      account: snapshot.profile,
      roles: snapshot.roles,
      isAdmin: snapshot.roles.includes('admin'),
      error,
      refreshAccount: () => loadAccount(session?.user ?? null),
      signOut: async () => {
        if (hasConfiguredBackend) await getSupabase().auth.signOut({ scope: 'local' });
      },
    }),
    [error, loadAccount, loading, session, snapshot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
