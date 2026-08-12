-- Publish the Phase 5 Android artifact as the sole current release.
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
  '1.2.0',
  3,
  null,
  'https://oeyrh6pi4us7bv7n.public.blob.vercel-storage.com/android/jela-ai-v1.2.0-build3-Wz2fiy9Ks5pIlRjoYfazGRJcmiBe2j.apk',
  120087786,
  '80A5E01C81917A966F75A0F03D7EC8FB760EE771F0F5E007B34F9E414E3A9994',
  null,
  true,
  '1.0.0',
  false
);
