import * as Linking from 'expo-linking';
import { CheckCircle2, Download } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ErrorState, LoadingState } from '@/components/feedback-state';
import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchLatestAndroidRelease } from '@/services/releases';
import type { AppRelease } from '@/types/database';
import type { UpdateState } from '@/lib/version';

type Result = { installedVersion: string; release: AppRelease | null; state: UpdateState };

export default function UpdateScreen() {
  const { colors } = useAppTheme();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try { setResult(await fetchLatestAndroidRelease()); setError(null); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not check for updates.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return (
    <PageScreen title="App update" subtitle="Official Android releases">
      {loading ? <LoadingState label="Checking for updates…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : result ? (
        <SectionCard>
          <View style={{ alignItems: 'center', gap: 12 }}>
            {result.state === 'current' ? <CheckCircle2 color={colors.success} size={48} /> : <Download color={colors.accent} size={48} />}
            <AppText variant="headline" style={{ textAlign: 'center' }}>{result.state === 'current' ? 'You’re up to date' : result.state === 'required' ? 'Update required' : 'Update available'}</AppText>
            <AppText tone="muted">Installed version {result.installedVersion}</AppText>
            {result.release ? <><AppText>Latest version {result.release.version_name}</AppText>{result.release.release_notes ? <AppText tone="muted" style={{ textAlign: 'center' }}>{result.release.release_notes}</AppText> : null}{result.state !== 'current' ? <Button onPress={() => Linking.openURL(result.release!.download_url)}>Open official download</Button> : null}</> : <AppText tone="muted" style={{ textAlign: 'center' }}>No Android release has been published by Jela AI yet.</AppText>}
          </View>
        </SectionCard>
      ) : null}
    </PageScreen>
  );
}
