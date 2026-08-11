import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/contexts/auth-context';
import { fetchFeatureFlags } from '@/services/features';
import type { FeatureFlags } from '@/types/database';

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

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setFlags(await fetchFeatureFlags());
      setError(null);
    } catch (featureError) {
      setError(featureError instanceof Error ? featureError.message : 'Could not load app features.');
      setFlags(defaults);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
