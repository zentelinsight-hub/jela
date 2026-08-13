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
import { AppState } from 'react-native';

import { hasConfiguredBackend } from '@/lib/config';
import { authErrorMessage, friendlyError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { fetchAccount, fetchCachedAccount, type AccountSnapshot } from '@/services/account';
import { fetchLoginStatus } from '@/services/security';
import { clearWorkspaceCache } from '@/lib/offline-cache';
import { completeGoogleCallback } from '@/services/oauth';

type AuthContextValue = {
  loading: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  securityLoading: boolean;
  verified: boolean;
  profileComplete: boolean;
  adminAccessGranted: boolean;
  account: AccountSnapshot['profile'];
  roles: AccountSnapshot['roles'];
  isAdmin: boolean;
  error: string | null;
  refreshAccount: () => Promise<void>;
  refreshSecurity: () => Promise<void>;
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
  const [securityLoading, setSecurityLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [adminAccessGranted, setAdminAccessGranted] = useState(false);
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

  const loadSecurity = useCallback(async (user: User | null) => {
    if (!user) {
      setVerified(false);
      setProfileComplete(false);
      setAdminAccessGranted(false);
      setSnapshot({ profile: null, roles: [] });
      setSecurityLoading(false);
      return;
    }
    setSecurityLoading(true);
    try {
      const status = await fetchLoginStatus();
      setVerified(status.verified);
      setProfileComplete(Boolean(status.profileComplete));
      setAdminAccessGranted(Boolean(status.adminAccessGranted));
      if (status.verified) await loadAccount(user);
      else setSnapshot({ profile: null, roles: [] });
      setError(null);
    } catch (securityError) {
      const cached = await fetchCachedAccount(user.id);
      if (cached?.profile) {
        setVerified(true);
        setProfileComplete(Boolean(cached.profile.profile_completed_at));
        setAdminAccessGranted(false);
        setSnapshot({ profile: cached.profile, roles: [] });
        setError('You’re offline. Cached workspace browsing is available; reconnect before using Jela or Admin.');
      } else {
        setVerified(false);
        setProfileComplete(false);
        setAdminAccessGranted(false);
        setSnapshot({ profile: null, roles: [] });
        setError(friendlyError(securityError, 'Could not verify this session. Sign in again.'));
      }
    } finally {
      setSecurityLoading(false);
    }
  }, [loadAccount]);

  useEffect(() => {
    if (!hasConfiguredBackend) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (sessionError) setError(authErrorMessage(sessionError, 'Could not restore your session. Sign in again.'));
      setSession(data.session);
      await loadSecurity(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setTimeout(() => void loadSecurity(nextSession?.user ?? null), 0);
    });

    const handleUrl = async ({ url }: { url: string }) => {
      const { accessToken, refreshToken, code } = extractTokens(url);
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      } else if (code) {
        const path = Linking.parse(url).path?.replace(/^\/+/, '');
        if (path === 'callback') await completeGoogleCallback(url);
        else await supabase.auth.exchangeCodeForSession(code);
      }
    };
    const urlListener = Linking.addEventListener('url', (event) => void handleUrl(event));
    Linking.getInitialURL().then((url) => url && void handleUrl({ url }));

    return () => {
      listener.subscription.unsubscribe();
      urlListener.remove();
    };
  }, [loadSecurity]);

  useEffect(() => {
    if (!session || !verified) return;
    const supabase = getSupabase();
    const channel = supabase.channel(`account-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_accounts', filter: `id=eq.${session.user.id}` }, () => void loadAccount(session.user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_subscriptions', filter: `user_id=eq.${session.user.id}` }, () => void loadAccount(session.user))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadAccount, session, verified]);

  useEffect(() => {
    if (!session) return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const supabase = getSupabase();
      void supabase.auth.getSession().then(({ data }) => {
        const currentUser = data.session?.user ?? null;
        setSession(data.session);
        void loadSecurity(currentUser);
      });
    });
    return () => listener.remove();
  }, [loadSecurity, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      configured: hasConfiguredBackend,
      session,
      user: session?.user ?? null,
      securityLoading,
      verified,
      profileComplete,
      adminAccessGranted,
      account: snapshot.profile,
      roles: snapshot.roles,
      isAdmin: snapshot.roles.includes('admin'),
      error,
      refreshAccount: () => loadAccount(session?.user ?? null),
      refreshSecurity: () => loadSecurity(session?.user ?? null),
      signOut: async () => {
        if (hasConfiguredBackend) await getSupabase().auth.signOut({ scope: 'global' });
        await clearWorkspaceCache();
      },
    }),
    [adminAccessGranted, error, loadAccount, loadSecurity, loading, profileComplete, securityLoading, session, snapshot, verified],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
