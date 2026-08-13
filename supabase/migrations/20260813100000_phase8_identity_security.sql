-- Phase 8 identity, session assurance, profile integrity, generated media, and lifecycle controls.
-- OTP values and administrative access codes are never stored in application tables.

alter table public.jela_accounts
  add column if not exists username text,
  add column if not exists age smallint,
  add column if not exists profile_completed_at timestamptz,
  add column if not exists google_identity boolean not null default false,
  add column if not exists password_set_at timestamptz;

alter table public.jela_accounts drop constraint if exists jela_accounts_username_format;
alter table public.jela_accounts add constraint jela_accounts_username_format check (
  username is null or (
    username = lower(btrim(username))
    and username ~ '^[a-z0-9_]{3,30}$'
  )
);
alter table public.jela_accounts drop constraint if exists jela_accounts_age_range;
alter table public.jela_accounts add constraint jela_accounts_age_range
  check (age is null or age between 13 and 120);
create unique index if not exists jela_accounts_username_ci_unique
  on public.jela_accounts(lower(username)) where username is not null;
create index if not exists jela_accounts_status_created_idx
  on public.jela_accounts(status, created_at desc);

-- Google OAuth exposes identity details through auth.users.raw_user_meta_data.
-- Import only missing fields so a later Google login never overwrites profile choices made in Jela.
create or replace function public.handle_new_jela_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  free_version_id uuid;
  initial_role public.jela_role := 'user';
  identity_name text := btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  ));
  identity_first_name text := btrim(coalesce(
    new.raw_user_meta_data ->> 'given_name',
    new.raw_user_meta_data ->> 'first_name',
    split_part(identity_name, ' ', 1),
    ''
  ));
  identity_last_name text := btrim(coalesce(
    new.raw_user_meta_data ->> 'family_name',
    new.raw_user_meta_data ->> 'last_name',
    case when position(' ' in identity_name) > 0 then substring(identity_name from position(' ' in identity_name) + 1) else '' end,
    ''
  ));
  identity_avatar text := btrim(coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    ''
  ));
  is_google_identity boolean := (
    coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google'
    or coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  );
begin
  select p.current_version_id into free_version_id from public.jela_plans p where p.code = 'free';
  if lower(new.email) = 'zentelinsight@gmail.com' then initial_role := 'admin'; end if;
  if identity_avatar !~ '^https://' then identity_avatar := ''; end if;

  insert into public.jela_accounts(
    id, first_name, last_name, display_name, avatar_url, google_identity, password_set_at
  )
  values (
    new.id,
    left(identity_first_name, 60),
    left(identity_last_name, 60),
    nullif(left(identity_name, 100), ''),
    nullif(identity_avatar, ''),
    is_google_identity,
    case when is_google_identity then null else now() end
  ) on conflict (id) do nothing;
  insert into public.jela_account_roles(user_id, role)
  values (new.id, initial_role) on conflict do nothing;
  insert into public.jela_credit_wallets(
    user_id, balance, allowance, lifetime_granted, plan_version_id, period_started_at
  ) values (new.id, 60, 60, 60, free_version_id, now())
  on conflict (user_id) do nothing;
  insert into public.jela_user_settings(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Backfill incomplete Google accounts created before this migration without replacing user edits.
update public.jela_accounts account
set first_name = case when btrim(account.first_name) = '' then left(btrim(coalesce(
      auth_user.raw_user_meta_data ->> 'given_name', auth_user.raw_user_meta_data ->> 'first_name',
      split_part(coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'name', ''), ' ', 1)
    )), 60) else account.first_name end,
    last_name = case when btrim(account.last_name) = '' then left(btrim(coalesce(
      auth_user.raw_user_meta_data ->> 'family_name', auth_user.raw_user_meta_data ->> 'last_name',
      case when position(' ' in coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'name', '')) > 0
        then substring(coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'name', '')
          from position(' ' in coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'name', '')) + 1)
        else '' end
    )), 60) else account.last_name end,
    display_name = coalesce(account.display_name, nullif(left(btrim(coalesce(
      auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'name', ''
    )), 100), '')),
    avatar_url = coalesce(account.avatar_url, case
      when btrim(coalesce(auth_user.raw_user_meta_data ->> 'avatar_url', auth_user.raw_user_meta_data ->> 'picture', '')) ~ '^https://'
      then btrim(coalesce(auth_user.raw_user_meta_data ->> 'avatar_url', auth_user.raw_user_meta_data ->> 'picture'))
      else null end),
    google_identity = true,
    updated_at = now()
from auth.users auth_user
where auth_user.id = account.id
  and (
    coalesce(auth_user.raw_app_meta_data ->> 'provider', '') = 'google'
    or coalesce(auth_user.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  )
  and (
    btrim(account.first_name) = '' or btrim(account.last_name) = ''
    or account.display_name is null or (account.avatar_path is null and account.avatar_url is null)
  );

update public.jela_accounts account
set google_identity = true,
    updated_at = now()
from auth.users auth_user
where auth_user.id = account.id
  and (
    coalesce(auth_user.raw_app_meta_data ->> 'provider', '') = 'google'
    or coalesce(auth_user.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  )
  and not account.google_identity;

-- Existing email/password users already have an Auth password. Google accounts must set one once
-- inside the verified profile-completion flow before protected app features unlock.
update public.jela_accounts account
set password_set_at = coalesce(account.password_set_at, account.created_at),
    updated_at = now()
where not account.google_identity
  and account.password_set_at is null;

alter table public.jela_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.jela_subscriptions
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists provider_status_reason text;

create table if not exists public.jela_login_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_factor_session_id uuid not null,
  final_session_id uuid,
  first_factor_method text not null check (first_factor_method in ('password', 'oauth', 'sso', 'sensitive_action')),
  purpose text not null default 'login' check (purpose in ('login', 'sensitive_action')),
  email_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired', 'locked', 'cancelled', 'delivery_failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  resend_count integer not null default 0 check (resend_count >= 0),
  resend_available_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jela_login_challenges_user_created_idx
  on public.jela_login_challenges(user_id, created_at desc);
create index if not exists jela_login_challenges_session_status_idx
  on public.jela_login_challenges(first_factor_session_id, status, expires_at desc);

create table if not exists public.jela_session_verifications (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null unique references public.jela_login_challenges(id) on delete cascade,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists jela_session_verifications_user_idx
  on public.jela_session_verifications(user_id, verified_at desc);

create table if not exists public.jela_admin_session_grants (
  session_id uuid primary key references public.jela_session_verifications(session_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours'),
  revoked_at timestamptz,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  last_attempt_at timestamptz
);

create table if not exists public.jela_admin_access_config (
  singleton boolean primary key default true check (singleton),
  salt_hex text not null,
  hash_hex text not null,
  iterations integer not null check (iterations between 100000 and 1000000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.jela_generated_images (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  conversation_id uuid references public.jela_conversations(id) on delete cascade,
  message_id uuid references public.jela_messages(id) on delete set null,
  prompt text not null check (char_length(prompt) between 1 and 4000),
  revised_prompt text,
  model text not null,
  storage_path text not null unique,
  width integer not null default 1024 check (width between 256 and 4096),
  height integer not null default 1024 check (height between 256 and 4096),
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jela_generated_images_path_owner check (split_part(storage_path, '/', 1) = owner_id::text)
);
create index if not exists jela_generated_images_owner_created_idx
  on public.jela_generated_images(owner_id, created_at desc);
create index if not exists jela_generated_images_conversation_idx
  on public.jela_generated_images(conversation_id, created_at);

create or replace function public.jela_session_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when coalesce(auth.jwt() ->> 'session_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (auth.jwt() ->> 'session_id')::uuid
    else null
  end;
$$;

create or replace function public.is_jela_session_verified()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.jela_session_verifications verification
    where verification.session_id = public.jela_session_id()
      and verification.user_id = auth.uid()
      and verification.revoked_at is null
      and verification.expires_at > now()
  );
$$;

create or replace function public.is_jela_admin_session_granted()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.jela_admin_session_grants access_grant
    where access_grant.session_id = public.jela_session_id()
      and access_grant.user_id = auth.uid()
      and access_grant.revoked_at is null
      and access_grant.expires_at > now()
  );
$$;

create or replace function public.is_jela_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.jela_account_roles
    where user_id = check_user_id and role = 'admin'
  ) and (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or (
      check_user_id = auth.uid()
      and public.is_jela_session_verified()
      and public.is_jela_admin_session_granted()
    )
  );
$$;

create or replace function public.is_active_jela_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.jela_accounts
    where id = check_user_id and status = 'active'
      and char_length(btrim(first_name)) >= 2
      and char_length(btrim(last_name)) >= 2
      and username is not null
      and age is not null
      and profile_completed_at is not null
      and (not google_identity or password_set_at is not null)
  ) and (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or (check_user_id = auth.uid() and public.is_jela_session_verified())
  );
$$;

create or replace function public.is_jela_profile_complete(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.jela_accounts
    where id = check_user_id
      and char_length(btrim(first_name)) >= 2
      and char_length(btrim(last_name)) >= 2
      and username is not null
      and age is not null
      and profile_completed_at is not null
      and (not google_identity or password_set_at is not null)
  );
$$;

create or replace function public.is_jela_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_jela_session_verified()
    and lower(btrim(coalesce(p_username, ''))) ~ '^[a-z0-9_]{3,30}$'
    and not exists (
      select 1 from public.jela_accounts
      where lower(username) = lower(btrim(p_username)) and id <> auth.uid()
    );
$$;

create or replace function public.update_jela_profile_v2(
  p_first_name text,
  p_last_name text,
  p_display_name text,
  p_username text,
  p_age integer
)
returns public.jela_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_username text := lower(btrim(coalesce(p_username, '')));
  updated_account public.jela_accounts;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.is_jela_session_verified() then raise exception 'verification_required'; end if;
  if char_length(btrim(coalesce(p_first_name, ''))) not between 2 and 60
    or char_length(btrim(coalesce(p_last_name, ''))) not between 2 and 60
    or char_length(btrim(coalesce(p_display_name, ''))) > 100
    or normalized_username !~ '^[a-z0-9_]{3,30}$'
    or p_age not between 13 and 120
  then raise exception 'invalid_profile'; end if;

  update public.jela_accounts
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      display_name = nullif(btrim(p_display_name), ''),
      username = normalized_username,
      age = p_age,
      profile_completed_at = now()
  where id = auth.uid()
  returning * into updated_account;
  return updated_account;
exception when unique_violation then
  raise exception 'username_unavailable';
end;
$$;

-- Keep the legacy profile RPC safe for older clients during the forced-upgrade window.
create or replace function public.update_jela_profile(
  p_first_name text,
  p_last_name text,
  p_display_name text default null
)
returns public.jela_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare updated_account public.jela_accounts;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.is_jela_session_verified() then raise exception 'verification_required'; end if;
  if char_length(btrim(coalesce(p_first_name, ''))) not between 2 and 60
    or char_length(btrim(coalesce(p_last_name, ''))) not between 2 and 60
    or char_length(btrim(coalesce(p_display_name, ''))) > 100
  then raise exception 'invalid_profile'; end if;
  update public.jela_accounts
  set first_name = btrim(p_first_name), last_name = btrim(p_last_name),
      display_name = nullif(btrim(p_display_name), '')
  where id = auth.uid() returning * into updated_account;
  return updated_account;
end;
$$;

alter table public.jela_login_challenges enable row level security;
alter table public.jela_session_verifications enable row level security;
alter table public.jela_admin_session_grants enable row level security;
alter table public.jela_admin_access_config enable row level security;
alter table public.jela_generated_images enable row level security;

revoke all on public.jela_login_challenges, public.jela_session_verifications,
  public.jela_admin_session_grants, public.jela_admin_access_config from anon, authenticated;
grant all on public.jela_login_challenges, public.jela_session_verifications,
  public.jela_admin_session_grants, public.jela_admin_access_config to service_role;
grant select on public.jela_generated_images to authenticated;
grant all on public.jela_generated_images to service_role;

create policy "Users read their generated images and granted admins read all"
on public.jela_generated_images for select to authenticated
using (owner_id = auth.uid() or public.is_jela_admin());

do $$
declare protected_table text;
begin
  foreach protected_table in array array[
    'jela_accounts', 'jela_account_roles', 'jela_conversations', 'jela_messages',
    'jela_attachments', 'jela_subscriptions', 'jela_billing_records', 'jela_credit_wallets',
    'jela_credit_ledger', 'jela_model_config', 'jela_ai_usage', 'jela_push_tokens',
    'jela_security_events', 'jela_audit_logs', 'jela_plan_versions', 'jela_user_settings',
    'jela_user_ai_overrides', 'jela_trial_config', 'jela_user_trials', 'jela_payment_attempts',
    'jela_payment_events', 'jela_generated_images'
  ] loop
    if to_regclass('public.' || protected_table) is not null then
      execute format('drop policy if exists "Verified Jela sessions only" on public.%I', protected_table);
      execute format(
        'create policy "Verified Jela sessions only" on public.%I as restrictive for all to authenticated using (public.is_jela_session_verified()) with check (public.is_jela_session_verified())',
        protected_table
      );
    end if;
  end loop;
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('jela-generated-images', 'jela-generated-images', false, 15728640, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users read their generated image objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'jela-generated-images'
  and (split_part(name, '/', 1) = auth.uid()::text or public.is_jela_admin())
  and public.is_jela_session_verified()
);

create policy "Users delete their generated image objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'jela-generated-images'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.is_jela_session_verified()
);

-- Existing attachment/avatar policies are permissive, so add one restrictive policy that
-- makes a verified Jela session mandatory for every private Jela bucket operation.
create policy "Verified Jela sessions access private Jela storage"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id not in ('jela-attachments', 'jela-avatars', 'jela-generated-images')
  or public.is_jela_session_verified()
)
with check (
  bucket_id not in ('jela-attachments', 'jela-avatars', 'jela-generated-images')
  or public.is_jela_session_verified()
);

revoke all on function public.jela_session_id() from public;
revoke all on function public.is_jela_session_verified() from public;
revoke all on function public.is_jela_admin_session_granted() from public;
revoke all on function public.is_jela_profile_complete(uuid) from public;
revoke all on function public.is_jela_username_available(text) from public;
revoke all on function public.update_jela_profile_v2(text, text, text, text, integer) from public;
grant execute on function public.jela_session_id() to authenticated, service_role;
grant execute on function public.is_jela_session_verified() to authenticated, service_role;
grant execute on function public.is_jela_admin_session_granted() to authenticated, service_role;
grant execute on function public.is_jela_profile_complete(uuid) to authenticated, service_role;
grant execute on function public.is_jela_username_available(text) to authenticated;
grant execute on function public.update_jela_profile_v2(text, text, text, text, integer) to authenticated;

create or replace function public.admin_list_jela_accounts(
  p_query text default '',
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare result jsonb;
begin
  if not public.is_jela_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if p_limit not between 1 and 100 or p_offset < 0 then raise exception 'invalid_pagination'; end if;
  with filtered as (
    select account.id, auth_user.email, account.first_name, account.last_name,
      account.display_name, account.username, account.age, account.status, account.status_reason,
      account.profile_completed_at, account.created_at, auth_user.last_sign_in_at,
      exists(select 1 from public.jela_account_roles role where role.user_id = account.id and role.role = 'admin') as is_admin,
      plan.name as plan_name, subscription.status as subscription_status
    from public.jela_accounts account
    join auth.users auth_user on auth_user.id = account.id
    left join lateral (
      select current_subscription.plan_id, current_subscription.status
      from public.jela_subscriptions current_subscription
      where current_subscription.user_id = account.id
      order by (current_subscription.status in ('active','trialing')) desc, current_subscription.created_at desc
      limit 1
    ) subscription on true
    left join public.jela_plans plan on plan.id = subscription.plan_id
    where btrim(coalesce(p_query, '')) = ''
      or account.id::text ilike '%' || btrim(p_query) || '%'
      or coalesce(auth_user.email, '') ilike '%' || btrim(p_query) || '%'
      or coalesce(account.username, '') ilike '%' || btrim(p_query) || '%'
      or concat_ws(' ', account.first_name, account.last_name, account.display_name) ilike '%' || btrim(p_query) || '%'
  ), paged as (
    select * from filtered order by created_at desc limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_list_jela_accounts(text, integer, integer) from public;
grant execute on function public.admin_list_jela_accounts(text, integer, integer) to authenticated;

revoke execute on function public.get_my_jela_usage_state() from authenticated;
create or replace function public.get_my_jela_usage_state_v2()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_jela_session_verified() then raise exception 'verification_required'; end if;
  return public.get_my_jela_usage_state();
end;
$$;
revoke all on function public.get_my_jela_usage_state_v2() from public;
grant execute on function public.get_my_jela_usage_state_v2() to authenticated;

revoke execute on function public.set_jela_avatar_path(text) from authenticated;
create or replace function public.set_jela_avatar_path_v2(p_avatar_path text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_jela_session_verified() then raise exception 'verification_required'; end if;
  return public.set_jela_avatar_path(p_avatar_path);
end;
$$;
revoke all on function public.set_jela_avatar_path_v2(text) from public;
grant execute on function public.set_jela_avatar_path_v2(text) to authenticated;

create trigger set_jela_login_challenges_updated_at before update on public.jela_login_challenges
for each row execute function public.set_jela_updated_at();
create trigger set_jela_generated_images_updated_at before update on public.jela_generated_images
for each row execute function public.set_jela_updated_at();

insert into public.jela_app_config(key, value, description)
values
  ('image_generation_enabled', 'true'::jsonb, 'Server-side OpenAI image generation is available.'),
  ('login_email_otp_required', 'true'::jsonb, 'Every authenticated application session requires an email challenge.'),
  ('admin_access_gate_required', 'true'::jsonb, 'Administrator sessions require a second access-code gate after email verification.')
on conflict (key) do update set value = excluded.value, description = excluded.description, updated_at = now();
