import { webSupabase } from './supabase'

export type AndroidRelease = {
  id: string
  version_name: string
  version_code: number
  storage_path: string | null
  download_url: string | null
  file_size: number | null
  sha256: string | null
  release_notes: string | null
  published_at: string
  minimum_supported_version: string | null
}

export type ReleaseResult =
  | { status: 'available'; release: AndroidRelease; downloadUrl: string }
  | { status: 'empty' }
  | { status: 'error' }

export async function getCurrentAndroidRelease(): Promise<ReleaseResult> {
  if (!webSupabase) return { status: 'empty' }

  try {
    const { data, error } = await webSupabase
      .from('jela_ai_releases')
      .select(
        'id, version_name, version_code, storage_path, download_url, file_size, sha256, release_notes, published_at, minimum_supported_version',
      )
      .eq('platform', 'android')
      .eq('is_current', true)
      .maybeSingle<AndroidRelease>()

    if (error) return { status: 'error' }
    if (!data) return { status: 'empty' }

    if (data.download_url) {
      return { status: 'available', release: data, downloadUrl: data.download_url }
    }
    if (!data.storage_path) return { status: 'error' }

    const { data: signedUrlData, error: signedUrlError } = await webSupabase.storage
      .from('jela-ai-releases')
      .createSignedUrl(data.storage_path, 15 * 60, {
        download: `jela-ai-v${data.version_name}.apk`,
      })

    if (signedUrlError) return { status: 'error' }
    return { status: 'available', release: data, downloadUrl: signedUrlData.signedUrl }
  } catch {
    return { status: 'error' }
  }
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) return 'Not provided'
  const megabytes = bytes / 1024 / 1024
  return `${megabytes.toFixed(megabytes >= 10 ? 1 : 2)} MB`
}
