import { createClient } from '@supabase/supabase-js'

export type AndroidRelease = {
  id: string
  version_name: string
  version_code: number
  storage_path: string
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
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) return { status: 'empty' }

  try {
    const supabase = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase
      .from('jela_ai_releases')
      .select(
        'id, version_name, version_code, storage_path, file_size, sha256, release_notes, published_at, minimum_supported_version',
      )
      .eq('platform', 'android')
      .eq('is_current', true)
      .maybeSingle<AndroidRelease>()

    if (error) return { status: 'error' }
    if (!data) return { status: 'empty' }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
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
