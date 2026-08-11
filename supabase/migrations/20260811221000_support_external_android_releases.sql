-- Allow large release binaries to live in a durable external object store when
-- the Supabase project upload ceiling is lower than the signed APK size.
alter table public.jela_ai_releases
  add column if not exists download_url text;

alter table public.jela_ai_releases
  alter column storage_path drop not null;

alter table public.jela_ai_releases
  drop constraint if exists jela_ai_releases_storage_path_check;

alter table public.jela_ai_releases
  add constraint jela_ai_releases_storage_path_check
  check (storage_path is null or storage_path like 'android/%.apk');

alter table public.jela_ai_releases
  drop constraint if exists jela_ai_releases_download_source_check;

alter table public.jela_ai_releases
  add constraint jela_ai_releases_download_source_check
  check (
    storage_path is not null
    or download_url ~ '^https://[A-Za-z0-9.-]+/.*\.apk([?#].*)?$'
  );

comment on column public.jela_ai_releases.download_url is
  'Durable HTTPS APK URL used when the release binary is hosted outside Supabase Storage.';
