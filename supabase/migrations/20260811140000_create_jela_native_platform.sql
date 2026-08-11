-- Jela AI native application data plane and server-authoritative control plane.
-- Secrets and provider credentials are intentionally excluded from all public tables.

do $$ begin
  create type public.jela_account_status as enum ('active', 'suspended', 'disabled', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.jela_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.jela_message_role as enum ('user', 'assistant', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.jela_message_status as enum ('pending', 'streaming', 'complete', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.jela_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  display_name text,
  avatar_url text,
  status public.jela_account_status not null default 'active',
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jela_accounts_first_name_length check (char_length(first_name) <= 60),
  constraint jela_accounts_last_name_length check (char_length(last_name) <= 60),
  constraint jela_accounts_display_name_length check (display_name is null or char_length(display_name) <= 100)
);

create table if not exists public.jela_account_roles (
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  role public.jela_role not null default 'user',
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.jela_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  title text not null default 'New chat',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jela_conversations_title_length check (char_length(title) between 1 and 160)
);

create index if not exists jela_conversations_owner_updated_idx
  on public.jela_conversations(owner_id, updated_at desc);

create table if not exists public.jela_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.jela_conversations(id) on delete cascade,
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  role public.jela_message_role not null,
  content text not null default '',
  status public.jela_message_status not null default 'complete',
  request_id uuid,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jela_messages_content_length check (char_length(content) <= 200000),
  unique (owner_id, request_id, role)
);

create index if not exists jela_messages_conversation_created_idx
  on public.jela_messages(conversation_id, created_at);

create table if not exists public.jela_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  conversation_id uuid references public.jela_conversations(id) on delete cascade,
  message_id uuid references public.jela_messages(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status text not null default 'ready' check (status in ('uploading', 'ready', 'processing', 'failed', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jela_attachments_size check (size_bytes between 1 and 10485760),
  constraint jela_attachments_path_owner check (split_part(storage_path, '/', 1) = owner_id::text),
  constraint jela_attachments_mime check (mime_type in ('application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp'))
);

create index if not exists jela_attachments_owner_created_idx
  on public.jela_attachments(owner_id, created_at desc);

create table if not exists public.jela_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  price_minor bigint not null check (price_minor >= 0),
  interval text not null check (interval in ('month', 'year', 'one_time')),
  credits bigint not null check (credits >= 0),
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  checkout_url text,
  provider text,
  provider_price_id text,
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jela_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  plan_id uuid not null references public.jela_plans(id) on delete restrict,
  provider text not null,
  provider_subscription_id text not null unique,
  status text not null check (status in ('incomplete', 'trialing', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jela_subscriptions_user_status_idx
  on public.jela_subscriptions(user_id, status);

create table if not exists public.jela_billing_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  subscription_id uuid references public.jela_subscriptions(id) on delete set null,
  provider text not null,
  provider_record_id text not null unique,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null,
  description text,
  receipt_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.jela_credit_wallets (
  user_id uuid primary key references public.jela_accounts(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  reserved bigint not null default 0 check (reserved >= 0 and reserved <= balance),
  lifetime_granted bigint not null default 0 check (lifetime_granted >= 0),
  lifetime_used bigint not null default 0 check (lifetime_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jela_model_config (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  provider text not null check (provider in ('openai')),
  model text not null,
  system_prompt text not null default 'You are Jela AI, a helpful assistant from Zentel Insight.',
  input_credit_cost numeric(12,4) not null check (input_credit_cost >= 0),
  output_credit_cost numeric(12,4) not null check (output_credit_cost >= 0),
  request_credit_reserve bigint not null check (request_credit_reserve > 0),
  max_output_tokens integer not null check (max_output_tokens between 1 and 32768),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists jela_one_enabled_model
  on public.jela_model_config((enabled)) where enabled;

create table if not exists public.jela_ai_usage (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  conversation_id uuid not null references public.jela_conversations(id) on delete cascade,
  model_config_id uuid not null references public.jela_model_config(id) on delete restrict,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  credits_reserved bigint not null default 0 check (credits_reserved >= 0),
  credits_charged bigint not null default 0 check (credits_charged >= 0),
  status text not null check (status in ('processing', 'complete', 'failed')),
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jela_ai_usage_user_created_idx
  on public.jela_ai_usage(user_id, created_at desc);

create table if not exists public.jela_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  kind text not null check (kind in ('grant', 'purchase', 'usage', 'refund', 'admin_adjustment')),
  request_id uuid references public.jela_ai_usage(request_id) on delete set null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists jela_credit_ledger_user_created_idx
  on public.jela_credit_ledger(user_id, created_at desc);

create table if not exists public.jela_app_config (
  key text primary key,
  value jsonb not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jela_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  token_hash text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jela_security_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  subject_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.jela_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.jela_ai_releases
  add column if not exists force_update boolean not null default false;

create or replace function public.set_jela_updated_at()
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

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'jela_accounts', 'jela_conversations', 'jela_messages', 'jela_attachments',
    'jela_plans', 'jela_subscriptions', 'jela_credit_wallets', 'jela_model_config',
    'jela_app_config', 'jela_push_tokens'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_jela_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

create or replace function public.handle_new_jela_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_first_name text := left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 60);
  new_last_name text := left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 60);
begin
  insert into public.jela_accounts(id, first_name, last_name)
  values (new.id, new_first_name, new_last_name)
  on conflict (id) do nothing;

  insert into public.jela_account_roles(user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  insert into public.jela_credit_wallets(user_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_jela on auth.users;
create trigger on_auth_user_created_jela
after insert on auth.users
for each row execute function public.handle_new_jela_user();

insert into public.jela_accounts(id, first_name, last_name)
select
  user_row.id,
  left(coalesce(user_row.raw_user_meta_data ->> 'first_name', ''), 60),
  left(coalesce(user_row.raw_user_meta_data ->> 'last_name', ''), 60)
from auth.users as user_row
on conflict (id) do nothing;

insert into public.jela_account_roles(user_id, role)
select id, 'user' from public.jela_accounts
on conflict do nothing;

insert into public.jela_credit_wallets(user_id)
select id from public.jela_accounts
on conflict do nothing;

create or replace function public.is_jela_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.jela_account_roles
    where user_id = check_user_id and role = 'admin'
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
    select 1
    from public.jela_accounts
    where id = check_user_id and status = 'active'
  );
$$;

revoke all on function public.is_jela_admin(uuid) from public;
revoke all on function public.is_active_jela_user(uuid) from public;
grant execute on function public.is_jela_admin(uuid) to authenticated, service_role;
grant execute on function public.is_active_jela_user(uuid) to authenticated, service_role;

alter table public.jela_accounts enable row level security;
alter table public.jela_account_roles enable row level security;
alter table public.jela_conversations enable row level security;
alter table public.jela_messages enable row level security;
alter table public.jela_attachments enable row level security;
alter table public.jela_plans enable row level security;
alter table public.jela_subscriptions enable row level security;
alter table public.jela_billing_records enable row level security;
alter table public.jela_credit_wallets enable row level security;
alter table public.jela_credit_ledger enable row level security;
alter table public.jela_model_config enable row level security;
alter table public.jela_ai_usage enable row level security;
alter table public.jela_app_config enable row level security;
alter table public.jela_push_tokens enable row level security;
alter table public.jela_security_events enable row level security;
alter table public.jela_audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.jela_accounts, public.jela_account_roles, public.jela_conversations,
  public.jela_messages, public.jela_attachments, public.jela_plans, public.jela_subscriptions,
  public.jela_billing_records, public.jela_credit_wallets, public.jela_credit_ledger,
  public.jela_ai_usage, public.jela_app_config, public.jela_ai_releases,
  public.jela_model_config, public.jela_security_events, public.jela_audit_logs
to authenticated;
grant insert, update, delete on public.jela_conversations, public.jela_attachments to authenticated;
grant select, insert, update, delete on public.jela_push_tokens to authenticated;
grant select on public.jela_ai_releases to anon;
grant all on all tables in schema public to service_role;

create policy "Accounts are visible to their owner or admins"
on public.jela_accounts for select to authenticated
using (id = auth.uid() or public.is_jela_admin());

create policy "Roles are visible to their owner or admins"
on public.jela_account_roles for select to authenticated
using (user_id = auth.uid() or public.is_jela_admin());

create policy "Users read their conversations and admins read all"
on public.jela_conversations for select to authenticated
using (owner_id = auth.uid() or public.is_jela_admin());

create policy "Active users create their own conversations"
on public.jela_conversations for insert to authenticated
with check (owner_id = auth.uid() and public.is_active_jela_user());

create policy "Active users update their own conversations"
on public.jela_conversations for update to authenticated
using (owner_id = auth.uid() and public.is_active_jela_user())
with check (owner_id = auth.uid() and public.is_active_jela_user());

create policy "Active users delete their own conversations"
on public.jela_conversations for delete to authenticated
using (owner_id = auth.uid() and public.is_active_jela_user());

create policy "Users read their messages and admins read all"
on public.jela_messages for select to authenticated
using (owner_id = auth.uid() or public.is_jela_admin());

create policy "Users read their attachments and admins read all"
on public.jela_attachments for select to authenticated
using (owner_id = auth.uid() or public.is_jela_admin());

create policy "Active users register their own attachments"
on public.jela_attachments for insert to authenticated
with check (owner_id = auth.uid() and public.is_active_jela_user());

create policy "Active users update their own attachments"
on public.jela_attachments for update to authenticated
using (owner_id = auth.uid() and public.is_active_jela_user())
with check (owner_id = auth.uid() and public.is_active_jela_user());

create policy "Active users delete their own attachments"
on public.jela_attachments for delete to authenticated
using (owner_id = auth.uid() and public.is_active_jela_user());

create policy "Users read active plans and admins read all"
on public.jela_plans for select to authenticated
using (active or public.is_jela_admin());

create policy "Users read their subscriptions and admins read all"
on public.jela_subscriptions for select to authenticated
using (user_id = auth.uid() or public.is_jela_admin());

create policy "Users read their billing and admins read all"
on public.jela_billing_records for select to authenticated
using (user_id = auth.uid() or public.is_jela_admin());

create policy "Users read their wallet and admins read all"
on public.jela_credit_wallets for select to authenticated
using (user_id = auth.uid() or public.is_jela_admin());

create policy "Users read their ledger and admins read all"
on public.jela_credit_ledger for select to authenticated
using (user_id = auth.uid() or public.is_jela_admin());

create policy "Users read their usage and admins read all"
on public.jela_ai_usage for select to authenticated
using (user_id = auth.uid() or public.is_jela_admin());

create policy "Authenticated users read app feature flags"
on public.jela_app_config for select to authenticated
using (true);

create policy "Only admins read model configuration"
on public.jela_model_config for select to authenticated
using (public.is_jela_admin());

create policy "Only admins read security events"
on public.jela_security_events for select to authenticated
using (public.is_jela_admin());

create policy "Only admins read audit logs"
on public.jela_audit_logs for select to authenticated
using (public.is_jela_admin());

create policy "Users manage their own push tokens"
on public.jela_push_tokens for all to authenticated
using (user_id = auth.uid() and public.is_active_jela_user())
with check (user_id = auth.uid() and public.is_active_jela_user());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'jela-attachments',
  'jela-attachments',
  false,
  10485760,
  array['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Active users upload into their private attachment folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'jela-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.is_active_jela_user()
);

create policy "Users read their private attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'jela-attachments'
  and (split_part(name, '/', 1) = auth.uid()::text or public.is_jela_admin())
);

create policy "Active users update their private attachments"
on storage.objects for update to authenticated
using (
  bucket_id = 'jela-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.is_active_jela_user()
)
with check (
  bucket_id = 'jela-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.is_active_jela_user()
);

create policy "Active users delete their private attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'jela-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.is_active_jela_user()
);

insert into public.jela_app_config(key, value, description)
values
  ('chat_enabled', 'false'::jsonb, 'AI chat is available only after a model, credits, and provider secret are configured.'),
  ('attachments_enabled', 'false'::jsonb, 'Private chat attachments are intentionally disabled until the processing pipeline is approved.'),
  ('voice_enabled', 'false'::jsonb, 'Voice has not been implemented or released.'),
  ('push_notifications_enabled', 'false'::jsonb, 'Push notifications are prepared but not active.'),
  ('maintenance_mode', 'false'::jsonb, 'Global maintenance state.')
on conflict (key) do nothing;

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
declare
  updated_account public.jela_accounts;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if char_length(trim(p_first_name)) not between 2 and 60
    or char_length(trim(p_last_name)) not between 2 and 60
    or (p_display_name is not null and char_length(trim(p_display_name)) > 100)
  then raise exception 'invalid_profile'; end if;

  update public.jela_accounts
  set first_name = trim(p_first_name),
      last_name = trim(p_last_name),
      display_name = nullif(trim(p_display_name), '')
  where id = auth.uid()
  returning * into updated_account;
  return updated_account;
end;
$$;

create or replace function public.admin_set_jela_account_status(
  p_user_id uuid,
  p_status public.jela_account_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_jela_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if p_user_id = auth.uid() and p_status <> 'active' then raise exception 'cannot_block_self'; end if;
  if p_status <> 'active' and char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'status_reason_required';
  end if;

  update public.jela_accounts
  set status = p_status,
      status_reason = case when p_status = 'active' then null else trim(p_reason) end
  where id = p_user_id;
  if not found then raise exception 'account_not_found'; end if;

  insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'account.status_changed', 'account', p_user_id::text,
    jsonb_build_object('status', p_status, 'reason', p_reason));
end;
$$;

create or replace function public.admin_adjust_jela_credits(
  p_user_id uuid,
  p_amount bigint,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_balance bigint;
begin
  if not public.is_jela_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if p_amount = 0 or char_length(trim(p_reason)) < 3 then raise exception 'invalid_adjustment'; end if;

  update public.jela_credit_wallets
  set balance = balance + p_amount,
      lifetime_granted = lifetime_granted + greatest(p_amount, 0)
  where user_id = p_user_id and balance + p_amount >= reserved
  returning balance into next_balance;
  if not found then raise exception 'invalid_balance_or_account'; end if;

  insert into public.jela_credit_ledger(user_id, amount, balance_after, kind, description, created_by)
  values (p_user_id, p_amount, next_balance, 'admin_adjustment', trim(p_reason), auth.uid());
  insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'credits.adjusted', 'account', p_user_id::text,
    jsonb_build_object('amount', p_amount, 'reason', p_reason, 'balance_after', next_balance));
  return next_balance;
end;
$$;

revoke all on function public.update_jela_profile(text, text, text) from public;
revoke all on function public.admin_set_jela_account_status(uuid, public.jela_account_status, text) from public;
revoke all on function public.admin_adjust_jela_credits(uuid, bigint, text) from public;
grant execute on function public.update_jela_profile(text, text, text) to authenticated;
grant execute on function public.admin_set_jela_account_status(uuid, public.jela_account_status, text) to authenticated;
grant execute on function public.admin_adjust_jela_credits(uuid, bigint, text) to authenticated;

create or replace function public.begin_jela_chat_request(
  p_user_id uuid,
  p_request_id uuid,
  p_conversation_id uuid,
  p_message text,
  p_attachment_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_account public.jela_accounts;
  selected_model public.jela_model_config;
  selected_wallet public.jela_credit_wallets;
  selected_usage public.jela_ai_usage;
  selected_conversation public.jela_conversations;
  user_message_id uuid;
  assistant_message_id uuid;
  assistant_content text;
  expected_attachments integer := coalesce(array_length(p_attachment_ids, 1), 0);
  valid_attachments integer := 0;
begin
  if char_length(trim(p_message)) not between 1 and 8000 then raise exception 'invalid_message'; end if;

  select * into selected_account from public.jela_accounts where id = p_user_id;
  if selected_account.id is null then raise exception 'account_not_found'; end if;
  if selected_account.status <> 'active' then raise exception 'account_unavailable'; end if;
  if not coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'chat_enabled'), false)
  then raise exception 'chat_not_enabled'; end if;

  select * into selected_usage from public.jela_ai_usage where request_id = p_request_id;
  if selected_usage.id is not null then
    if selected_usage.user_id <> p_user_id then raise exception 'idempotency_conflict'; end if;
    select id into user_message_id from public.jela_messages
      where owner_id = p_user_id and request_id = p_request_id and role = 'user';
    select id, content into assistant_message_id, assistant_content from public.jela_messages
      where owner_id = p_user_id and request_id = p_request_id and role = 'assistant';
    if selected_usage.status in ('complete', 'processing') then
      return jsonb_build_object(
        'replay', true,
        'status', selected_usage.status,
        'conversation_id', selected_usage.conversation_id,
        'user_message_id', user_message_id,
        'assistant_message_id', assistant_message_id,
        'assistant_content', assistant_content
      );
    end if;

    select * into selected_model from public.jela_model_config
    where id = selected_usage.model_config_id;
    if selected_model.id is null then raise exception 'model_not_configured'; end if;
    select * into selected_wallet from public.jela_credit_wallets
    where user_id = p_user_id for update;
    if selected_wallet.balance - selected_wallet.reserved < selected_model.request_credit_reserve
    then raise exception 'insufficient_credits'; end if;

    update public.jela_credit_wallets
    set reserved = reserved + selected_model.request_credit_reserve
    where user_id = p_user_id;
    update public.jela_ai_usage
    set status = 'processing',
        credits_reserved = selected_model.request_credit_reserve,
        credits_charged = 0,
        error_code = null,
        error_message = null,
        completed_at = null,
        started_at = now()
    where id = selected_usage.id;
    update public.jela_messages
    set content = '', status = 'streaming', error_code = null
    where id = assistant_message_id;

    return jsonb_build_object(
      'replay', false,
      'status', 'processing',
      'conversation_id', selected_usage.conversation_id,
      'user_message_id', user_message_id,
      'assistant_message_id', assistant_message_id,
      'provider', selected_model.provider,
      'model', selected_model.model,
      'system_prompt', selected_model.system_prompt,
      'max_output_tokens', selected_model.max_output_tokens
    );
  end if;

  select * into selected_model from public.jela_model_config where enabled limit 1;
  if selected_model.id is null then raise exception 'model_not_configured'; end if;

  if expected_attachments > 0 then
    if not coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'attachments_enabled'), false)
    then raise exception 'attachments_not_enabled'; end if;
    if expected_attachments > 5 then raise exception 'too_many_attachments'; end if;
    select count(*) into valid_attachments from public.jela_attachments
    where id = any(p_attachment_ids) and owner_id = p_user_id and status = 'ready';
    if valid_attachments <> expected_attachments then raise exception 'invalid_attachment'; end if;
  end if;

  select * into selected_wallet from public.jela_credit_wallets where user_id = p_user_id for update;
  if selected_wallet.user_id is null then raise exception 'wallet_not_found'; end if;
  if selected_wallet.balance - selected_wallet.reserved < selected_model.request_credit_reserve
  then raise exception 'insufficient_credits'; end if;

  if p_conversation_id is null then
    insert into public.jela_conversations(owner_id, title)
    values (p_user_id, left(regexp_replace(trim(p_message), '\s+', ' ', 'g'), 80))
    returning * into selected_conversation;
  else
    select * into selected_conversation from public.jela_conversations
    where id = p_conversation_id and owner_id = p_user_id and archived_at is null
    for update;
    if selected_conversation.id is null then raise exception 'conversation_not_found'; end if;
  end if;

  insert into public.jela_messages(conversation_id, owner_id, role, content, status, request_id)
  values (selected_conversation.id, p_user_id, 'user', trim(p_message), 'complete', p_request_id)
  returning id into user_message_id;

  insert into public.jela_messages(conversation_id, owner_id, role, content, status, request_id)
  values (selected_conversation.id, p_user_id, 'assistant', '', 'streaming', p_request_id)
  returning id into assistant_message_id;

  if expected_attachments > 0 then
    update public.jela_attachments
    set conversation_id = selected_conversation.id, message_id = user_message_id
    where id = any(p_attachment_ids) and owner_id = p_user_id;
  end if;

  update public.jela_credit_wallets
  set reserved = reserved + selected_model.request_credit_reserve
  where user_id = p_user_id;

  insert into public.jela_ai_usage(
    request_id, user_id, conversation_id, model_config_id, model,
    credits_reserved, status
  ) values (
    p_request_id, p_user_id, selected_conversation.id, selected_model.id,
    selected_model.model, selected_model.request_credit_reserve, 'processing'
  );

  update public.jela_conversations set updated_at = now() where id = selected_conversation.id;

  return jsonb_build_object(
    'replay', false,
    'status', 'processing',
    'conversation_id', selected_conversation.id,
    'user_message_id', user_message_id,
    'assistant_message_id', assistant_message_id,
    'provider', selected_model.provider,
    'model', selected_model.model,
    'system_prompt', selected_model.system_prompt,
    'max_output_tokens', selected_model.max_output_tokens
  );
end;
$$;

create or replace function public.complete_jela_chat_request(
  p_user_id uuid,
  p_request_id uuid,
  p_content text,
  p_input_tokens integer,
  p_output_tokens integer
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_usage public.jela_ai_usage;
  selected_model public.jela_model_config;
  computed_charge bigint;
  next_balance bigint;
begin
  select * into selected_usage from public.jela_ai_usage
  where request_id = p_request_id and user_id = p_user_id for update;
  if selected_usage.id is null then raise exception 'request_not_found'; end if;
  if selected_usage.status = 'complete' then return selected_usage.credits_charged; end if;
  if selected_usage.status <> 'processing' then raise exception 'request_not_processing'; end if;
  if char_length(p_content) = 0 or char_length(p_content) > 200000 then raise exception 'invalid_response'; end if;
  if p_input_tokens < 0 or p_output_tokens < 0 then raise exception 'invalid_usage'; end if;

  select * into selected_model from public.jela_model_config where id = selected_usage.model_config_id;
  computed_charge := least(
    selected_usage.credits_reserved,
    ceil((p_input_tokens::numeric / 1000) * selected_model.input_credit_cost
      + (p_output_tokens::numeric / 1000) * selected_model.output_credit_cost)::bigint
  );

  update public.jela_credit_wallets
  set reserved = reserved - selected_usage.credits_reserved,
      balance = balance - computed_charge,
      lifetime_used = lifetime_used + computed_charge
  where user_id = p_user_id
  returning balance into next_balance;

  update public.jela_messages
  set content = p_content, status = 'complete', error_code = null
  where owner_id = p_user_id and request_id = p_request_id and role = 'assistant';

  update public.jela_ai_usage
  set input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      credits_charged = computed_charge,
      status = 'complete',
      completed_at = now()
  where id = selected_usage.id;

  if computed_charge > 0 then
    insert into public.jela_credit_ledger(user_id, amount, balance_after, kind, request_id, description)
    values (p_user_id, -computed_charge, next_balance, 'usage', p_request_id, 'Jela AI response');
  end if;
  return computed_charge;
end;
$$;

create or replace function public.fail_jela_chat_request(
  p_user_id uuid,
  p_request_id uuid,
  p_error_code text,
  p_error_message text,
  p_partial_content text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_usage public.jela_ai_usage;
begin
  select * into selected_usage from public.jela_ai_usage
  where request_id = p_request_id and user_id = p_user_id for update;
  if selected_usage.id is null or selected_usage.status <> 'processing' then return; end if;

  update public.jela_credit_wallets
  set reserved = reserved - selected_usage.credits_reserved
  where user_id = p_user_id;

  update public.jela_messages
  set content = left(coalesce(p_partial_content, ''), 200000),
      status = 'failed',
      error_code = left(coalesce(p_error_code, 'provider_error'), 100)
  where owner_id = p_user_id and request_id = p_request_id and role = 'assistant';

  update public.jela_ai_usage
  set status = 'failed',
      error_code = left(coalesce(p_error_code, 'provider_error'), 100),
      error_message = left(coalesce(p_error_message, 'The provider request failed.'), 1000),
      completed_at = now()
  where id = selected_usage.id;
end;
$$;

revoke all on function public.begin_jela_chat_request(uuid, uuid, uuid, text, uuid[]) from public;
revoke all on function public.complete_jela_chat_request(uuid, uuid, text, integer, integer) from public;
revoke all on function public.fail_jela_chat_request(uuid, uuid, text, text, text) from public;
grant execute on function public.begin_jela_chat_request(uuid, uuid, uuid, text, uuid[]) to service_role;
grant execute on function public.complete_jela_chat_request(uuid, uuid, text, integer, integer) to service_role;
grant execute on function public.fail_jela_chat_request(uuid, uuid, text, text, text) to service_role;

comment on table public.jela_model_config is
  'Non-secret model policy. Provider API keys remain Supabase Edge Function secrets.';
comment on table public.jela_credit_wallets is
  'Backend-authoritative credit balances. Mobile clients have read-only access.';
comment on function public.begin_jela_chat_request(uuid, uuid, uuid, text, uuid[]) is
  'Transactional idempotency, ownership, feature, model, attachment, and credit reservation gate.';
