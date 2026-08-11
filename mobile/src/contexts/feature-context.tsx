import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { friendlyError } from '@/lib/errors';
import { fetchFeatureFlags } from '@/services/features';
import type { FeatureFlags } from '@/types/database';
import { getSupabase } from '@/lib/supabase';

const defaults: FeatureFlags = {
  chat_enabled: false,
  attachments_enabled: false,
  voice_enabled: false,
  push_notifications_enabled: false,
  maintenance_mode: false,
};

type FeatureContextValue = {
  flags: FeatureFlags;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const FeatureContext = createContext<FeatureContextValue | null>(null);

export function FeatureProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [flags, setFlags] = useState(defaults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const refresh = useCallback(async () => {
    if (!session) return;
    if (!initialized.current) setLoading(true);
    try {
      setFlags(await fetchFeatureFlags());
      setError(null);
    } catch (featureError) {
      setError(friendlyError(featureError, 'Could not load app features.'));
    } finally {
      initialized.current = true;
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!session) return;
    const supabase = getSupabase();
    const channel = supabase.channel('app-config-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_app_config' }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh, session]);

  useEffect(() => {
    if (!session) return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => listener.remove();
  }, [refresh, session]);

  const value = useMemo(
    () => ({ flags, loading, error, refresh }),
    [error, flags, loading, refresh],
  );
  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>;
}

export function useFeatures() {
  const value = useContext(FeatureContext);
  if (!value) throw new Error('useFeatures must be used inside FeatureProvider.');
  return value;
}
