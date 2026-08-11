import * as Application from 'expo-application';

import { getSupabase } from '@/lib/supabase';
import { resolveUpdateState } from '@/lib/version';
import type { AppRelease } from '@/types/database';

export async function fetchLatestAndroidRelease() {
  const supabase = getSupabase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const { data, error } = await supabase
    .from('jela_ai_releases')
    .select('id,platform,version_name,version_code,storage_path,release_notes,published_at,minimum_supported_version,force_update,is_current')
    .eq('platform', 'android')
    .eq('is_current', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .abortSignal(controller.signal)
    .maybeSingle();
  clearTimeout(timer);
  if (error) throw error;

  let release: AppRelease | null = null;
  if (data) {
    const signed = await supabase.storage
      .from('jela-ai-releases')
      .createSignedUrl(data.storage_path, 15 * 60, {
        download: `jela-ai-v${data.version_name}.apk`,
      });
    if (signed.error) throw signed.error;
    release = { ...(data as Omit<AppRelease, 'download_url'>), download_url: signed.data.signedUrl };
  }
  const installedVersion = Application.nativeApplicationVersion ?? '1.0.0';
  return {
    installedVersion,
    release,
    state: release
      ? resolveUpdateState(
          installedVersion,
          release.version_name,
          release.minimum_supported_version,
          release.force_update,
        )
      : ('current' as const),
  };
}
