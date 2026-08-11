-- Publish the verified Phase 4 Android artifact as the sole current release.
update public.jela_ai_releases
set is_current = false
where platform = 'android'
  and is_current;

insert into public.jela_ai_releases (
  platform,
  version_name,
  version_code,
  storage_path,
  download_url,
  file_size,
  sha256,
  release_notes,
  is_current,
  minimum_supported_version,
  force_update
)
values (
  'android',
  '1.1.0',
  2,
  null,
  'https://oeyrh6pi4us7bv7n.public.blob.vercel-storage.com/android/jela-ai-v1.1.0-build2-JUNXcBRHYF2qgIKOvk8n1s8qAwN6mv.apk',
  118297740,
  '29D0CC5736CF5A121E2339878A94F3167641AEA3F11FEF3C05CE7F37721E3B50',
  'Phase 4 production release with live Supabase sync, improved attachments, Admin tooling, release updates, and refined Jela AI branding.',
  true,
  '1.0.0',
  false
);
