-- Public Android release metadata and APK storage foundation for Jela AI.
create table if not exists public.jela_ai_releases (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'android' check (platform = 'android'),
  version_name text not null check (length(trim(version_name)) > 0),
  version_code bigint not null check (version_code > 0),
  storage_path text not null check (storage_path like 'android/%.apk'),
  file_size bigint check (file_size is null or file_size > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[A-Fa-f0-9]{64}$'),
  release_notes text,
  published_at timestamptz not null default now(),
  is_current boolean not null default false,
  minimum_supported_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.jela_ai_releases is
  'Versioned Jela AI APK release metadata. Previous rows are retained for rollback.';

create unique index if not exists jela_ai_one_current_release_per_platform
  on public.jela_ai_releases (platform)
  where is_current;

create index if not exists jela_ai_releases_published_at_idx
  on public.jela_ai_releases (published_at desc);

create or replace function public.set_jela_ai_release_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_jela_ai_release_updated_at on public.jela_ai_releases;
create trigger set_jela_ai_release_updated_at
before update on public.jela_ai_releases
for each row execute function public.set_jela_ai_release_updated_at();

alter table public.jela_ai_releases enable row level security;

revoke all on table public.jela_ai_releases from anon, authenticated;
grant select on table public.jela_ai_releases to anon, authenticated;

create policy "Public can read the current Android release"
on public.jela_ai_releases
for select
to anon, authenticated
using (platform = 'android' and is_current);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jela-ai-releases',
  'jela-ai-releases',
  false,
  262144000,
  array[
    'application/vnd.android.package-archive',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can download the current Jela AI release"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'jela-ai-releases'
  and exists (
    select 1
    from public.jela_ai_releases as release
    where release.platform = 'android'
      and release.is_current
      and release.storage_path = storage.objects.name
  )
);
