-- Jela AI Phase 3: authoritative commercial configuration, hidden usage,
-- profile storage, user preferences, trials, and auditable Admin controls.
-- Provider secrets remain in Supabase Edge Function secrets only.

alter table public.jela_accounts
  add column if not exists avatar_path text;

alter table public.jela_plans
  add column if not exists most_popular boolean not null default false,
  add column if not exists public_features jsonb not null default '[]'::jsonb,
  add column if not exists current_version_id uuid;

create table if not exists public.jela_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.jela_plans(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  price_minor bigint not null check (price_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null check (billing_interval in ('month', 'year', 'one_time')),
  internal_allowance bigint check (internal_allowance is null or internal_allowance > 0),
  feature_config jsonb not null default '{}'::jsonb,
  rate_limits jsonb not null default '{}'::jsonb,
  provider_plan_code text,
  purchasable boolean not null default false,
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, version_number),
  constraint jela_plan_versions_feature_object check (jsonb_typeof(feature_config) = 'object'),
  constraint jela_plan_versions_rate_object check (jsonb_typeof(rate_limits) = 'object')
);

do $$ begin
  alter table public.jela_plans
    add constraint jela_plans_current_version_fk
    foreign key (current_version_id) references public.jela_plan_versions(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.jela_subscriptions
  add column if not exists plan_version_id uuid references public.jela_plan_versions(id) on delete restrict,
  add column if not exists provider_customer_code text,
  add column if not exists provider_email_token text,
  add column if not exists grace_until timestamptz;

alter table public.jela_subscriptions drop constraint if exists jela_subscriptions_status_check;
alter table public.jela_subscriptions add constraint jela_subscriptions_status_check
  check (status in ('incomplete', 'trialing', 'active', 'past_due', 'grace_period', 'cancelled', 'expired', 'suspended'));

alter table public.jela_credit_wallets
  add column if not exists plan_version_id uuid references public.jela_plan_versions(id) on delete set null,
  add column if not exists allowance bigint check (allowance is null or allowance > 0),
  add column if not exists period_started_at timestamptz,
  add column if not exists period_ends_at timestamptz,
  add column if not exists exhausted_at timestamptz,
  add column if not exists next_free_reset_at timestamptz;

alter table public.jela_model_config
  add column if not exists mode text not null default 'auto' check (mode in ('auto', 'deep_think', 'research')),
  add column if not exists reasoning_effort text not null default 'low' check (reasoning_effort in ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
  add column if not exists tools jsonb not null default '[]'::jsonb,
  add column if not exists provider_input_usd_per_million numeric(12,6),
  add column if not exists provider_cached_input_usd_per_million numeric(12,6),
  add column if not exists provider_output_usd_per_million numeric(12,6),
  add column if not exists active_for_plans text[] not null default array['free']::text[];

drop index if exists public.jela_one_enabled_model;
create unique index if not exists jela_one_enabled_model_per_mode
  on public.jela_model_config(mode) where enabled;

alter table public.jela_ai_usage
  add column if not exists plan_version_id uuid references public.jela_plan_versions(id) on delete set null,
  add column if not exists mode text not null default 'auto',
  add column if not exists reasoning_effort text,
  add column if not exists cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  add column if not exists provider_request_id text,
  add column if not exists tool_calls jsonb not null default '[]'::jsonb,
  add column if not exists web_search_count integer not null default 0 check (web_search_count >= 0),
  add column if not exists file_operation_count integer not null default 0 check (file_operation_count >= 0),
  add column if not exists image_operation_count integer not null default 0 check (image_operation_count >= 0),
  add column if not exists duration_ms integer check (duration_ms is null or duration_ms >= 0),
  add column if not exists provider_estimated_cost_microusd bigint check (provider_estimated_cost_microusd is null or provider_estimated_cost_microusd >= 0),
  add column if not exists effective_config jsonb not null default '{}'::jsonb;

create table if not exists public.jela_user_settings (
  user_id uuid primary key references public.jela_accounts(id) on delete cascade,
  appearance text not null default 'system' check (appearance in ('system', 'light', 'dark')),
  notifications_enabled boolean not null default false,
  ai_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jela_user_ai_overrides (
  user_id uuid primary key references public.jela_accounts(id) on delete cascade,
  use_plan_defaults boolean not null default true,
  override_config jsonb not null default '{}'::jsonb,
  reason text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jela_trial_config (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  plan_version_id uuid references public.jela_plan_versions(id) on delete set null,
  duration_days integer not null default 7 check (duration_days between 1 and 90),
  internal_allowance bigint check (internal_allowance is null or internal_allowance > 0),
  eligibility jsonb not null default '{}'::jsonb,
  repeat_allowed boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.jela_user_trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  plan_version_id uuid not null references public.jela_plan_versions(id) on delete restrict,
  status text not null check (status in ('active', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  internal_allowance bigint not null check (internal_allowance > 0),
  granted_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.jela_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  plan_id uuid not null references public.jela_plans(id) on delete restrict,
  plan_version_id uuid not null references public.jela_plan_versions(id) on delete restrict,
  provider text not null default 'paystack' check (provider = 'paystack'),
  reference text not null unique,
  access_code text,
  authorization_url text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'initiated' check (status in ('initiated', 'processing', 'successful', 'declined', 'cancelled', 'failed', 'reversed', 'refunded')),
  provider_status text,
  provider_transaction_id text,
  channel text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jela_payment_attempts_user_created_idx
  on public.jela_payment_attempts(user_id, created_at desc);

create table if not exists public.jela_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack' check (provider = 'paystack'),
  event_fingerprint text not null unique,
  event_type text not null,
  reference text,
  signature_valid boolean not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

alter table public.jela_billing_records
  add column if not exists payment_attempt_id uuid references public.jela_payment_attempts(id) on delete set null,
  add column if not exists provider_reference text,
  add column if not exists provider_status text,
  add column if not exists channel text,
  add column if not exists paid_at timestamptz,
  add column if not exists receipt_number text;

create unique index if not exists jela_billing_provider_reference_unique
  on public.jela_billing_records(provider, provider_reference)
  where provider_reference is not null;

-- Public commercial plans. Hidden allowances live only in jela_plan_versions.
insert into public.jela_plans(
  code, name, description, currency, price_minor, interval, credits,
  features, public_features, active, sort_order, most_popular, provider
)
values
  ('free', 'Free', 'Limited daily AI use.', 'NGN', 0, 'month', 0,
    '["Limited daily AI use","Conversation history","Jela Auto"]'::jsonb,
    '["Limited daily AI use","Conversation history","Jela Auto"]'::jsonb, true, 0, false, null),
  ('starter', 'Starter', 'Higher limits for everyday learning and creation.', 'NGN', 1000000, 'month', 0,
    '["Higher usage limits","Jela Auto","Research where enabled","File and image analysis where enabled","Coding and study assistance","Conversation history"]'::jsonb,
    '["Higher usage limits","Jela Auto","Research where enabled","File and image analysis where enabled","Coding and study assistance","Conversation history"]'::jsonb, true, 10, false, 'paystack'),
  ('plus', 'Plus', 'Stronger reasoning, research and project assistance.', 'NGN', 1800000, 'month', 0,
    '["Significantly higher limits","Deep Think","Expanded Research","Advanced file analysis","Higher priority","Advanced coding and project assistance"]'::jsonb,
    '["Significantly higher limits","Deep Think","Expanded Research","Advanced file analysis","Higher priority","Advanced coding and project assistance"]'::jsonb, true, 20, true, 'paystack'),
  ('pro', 'Pro', 'Jela''s highest enabled limits and priority.', 'NGN', 3500000, 'month', 0,
    '["Highest enabled limits","Expanded advanced reasoning","Expanded research","Highest enabled file workloads","Priority processing","Advanced professional support"]'::jsonb,
    '["Highest enabled limits","Expanded advanced reasoning","Expanded research","Highest enabled file workloads","Priority processing","Advanced professional support"]'::jsonb, true, 30, false, 'paystack')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  currency = excluded.currency,
  price_minor = excluded.price_minor,
  interval = excluded.interval,
  features = excluded.features,
  public_features = excluded.public_features,
  active = excluded.active,
  sort_order = excluded.sort_order,
  most_popular = excluded.most_popular,
  provider = excluded.provider,
  updated_at = now();

insert into public.jela_plan_versions(
  plan_id, version_number, price_minor, currency, billing_interval,
  internal_allowance, feature_config, rate_limits, purchasable, active
)
select p.id, 1, p.price_minor, p.currency, p.interval,
  case when p.code = 'free' then 60 else null end,
  case p.code
    when 'free' then '{"auto":true,"deep_think":false,"research":false,"files":false,"images":false,"voice":false,"memory":false}'::jsonb
    when 'starter' then '{"auto":true,"deep_think":false,"research":true,"files":true,"images":true,"voice":false,"memory":false}'::jsonb
    when 'plus' then '{"auto":true,"deep_think":true,"research":true,"files":true,"images":true,"voice":false,"memory":false}'::jsonb
    else '{"auto":true,"deep_think":true,"research":true,"files":true,"images":true,"voice":false,"memory":false}'::jsonb
  end,
  case when p.code = 'free' then '{"requests_per_minute":4,"requests_per_day":60}'::jsonb else '{}'::jsonb end,
  false,
  true
from public.jela_plans p
where p.code in ('free', 'starter', 'plus', 'pro')
on conflict (plan_id, version_number) do update set
  price_minor = excluded.price_minor,
  currency = excluded.currency,
  billing_interval = excluded.billing_interval,
  feature_config = excluded.feature_config,
  rate_limits = excluded.rate_limits,
  active = true,
  updated_at = now();

update public.jela_plans p
set current_version_id = v.id
from public.jela_plan_versions v
where v.plan_id = p.id and v.version_number = 1 and p.code in ('free', 'starter', 'plus', 'pro');

insert into public.jela_trial_config(id, enabled) values (true, false)
on conflict (id) do nothing;

insert into public.jela_app_config(key, value, description)
values
  ('global_ai_enabled', 'true'::jsonb, 'Global server-side OpenAI execution state.'),
  ('chat_enabled', 'true'::jsonb, 'Jela chat is enabled through the authenticated Edge Function.'),
  ('streaming_enabled', 'true'::jsonb, 'Semantic Responses API streaming is enabled.'),
  ('research_enabled', 'false'::jsonb, 'Web research is disabled until Admin enables it.'),
  ('images_enabled', 'false'::jsonb, 'Image understanding is disabled until Admin enables it.'),
  ('memory_enabled', 'false'::jsonb, 'Memory is disabled until a reviewed implementation is enabled.'),
  ('trials_enabled', 'false'::jsonb, 'Trials start disabled and are controlled by Admin.'),
  ('ai_maintenance_mode', 'false'::jsonb, 'AI-only maintenance state.'),
  ('maintenance_message', '"Jela is temporarily unavailable. Please try again shortly."'::jsonb, 'Safe maintenance message.'),
  ('free_reset_hours', '24'::jsonb, 'Free usage resets 24 hours after authoritative exhaustion.'),
  ('default_mode', '"auto"'::jsonb, 'Default user-facing Jela mode.')
on conflict (key) do update set value = excluded.value, description = excluded.description, updated_at = now();

-- Current balanced OpenAI route. Pricing metadata mirrors the official model
-- page at migration time and remains Admin-editable. Provider keys are not stored.
insert into public.jela_model_config(
  name, provider, model, mode, system_prompt, input_credit_cost,
  output_credit_cost, request_credit_reserve, max_output_tokens, enabled,
  reasoning_effort, tools, provider_input_usd_per_million,
  provider_cached_input_usd_per_million, provider_output_usd_per_million,
  active_for_plans
)
values (
  'Jela Auto', 'openai', 'gpt-5.6-terra', 'auto',
  'You are Jela AI, a capable, careful assistant for learning, research, creation, coding, and practical problem-solving. Be accurate, professional, and transparent about uncertainty.',
  1, 2, 10, 4096, true, 'low', '[]'::jsonb,
  2.00, 0.20, 12.00, array['free','starter','plus','pro']
)
on conflict (name) do update set
  provider = excluded.provider,
  model = excluded.model,
  mode = excluded.mode,
  system_prompt = excluded.system_prompt,
  input_credit_cost = excluded.input_credit_cost,
  output_credit_cost = excluded.output_credit_cost,
  request_credit_reserve = excluded.request_credit_reserve,
  max_output_tokens = excluded.max_output_tokens,
  enabled = excluded.enabled,
  reasoning_effort = excluded.reasoning_effort,
  tools = excluded.tools,
  provider_input_usd_per_million = excluded.provider_input_usd_per_million,
  provider_cached_input_usd_per_million = excluded.provider_cached_input_usd_per_million,
  provider_output_usd_per_million = excluded.provider_output_usd_per_million,
  active_for_plans = excluded.active_for_plans,
  updated_at = now();

-- Initialise existing accounts with the Free plan without exposing raw units.
update public.jela_credit_wallets w
set plan_version_id = v.id,
    allowance = 60,
    balance = case when w.lifetime_used = 0 and w.balance = 0 then 60 else w.balance end,
    lifetime_granted = case when w.lifetime_used = 0 and w.balance = 0 then w.lifetime_granted + 60 else w.lifetime_granted end,
    period_started_at = coalesce(w.period_started_at, now()),
    updated_at = now()
from public.jela_plan_versions v
join public.jela_plans p on p.id = v.plan_id
where w.plan_version_id is null and p.code = 'free' and p.current_version_id = v.id;

insert into public.jela_user_settings(user_id)
select id from public.jela_accounts
on conflict (user_id) do nothing;

-- Server-side bootstrap for the designated authenticated Admin account.
insert into public.jela_account_roles(user_id, role, granted_by)
select u.id, 'admin'::public.jela_role, null
from auth.users u
join public.jela_accounts a on a.id = u.id
where lower(u.email) = 'zentelinsight@gmail.com'
on conflict (user_id, role) do nothing;

insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
select null, 'role.bootstrap_admin', 'account', u.id::text, jsonb_build_object('source', 'phase3_server_bootstrap')
from auth.users u
where lower(u.email) = 'zentelinsight@gmail.com'
  and not exists (
    select 1 from public.jela_audit_logs l
    where l.action = 'role.bootstrap_admin' and l.target_id = u.id::text
  );

create or replace function public.handle_new_jela_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  free_version_id uuid;
  initial_role public.jela_role := 'user';
begin
  select p.current_version_id into free_version_id
  from public.jela_plans p where p.code = 'free';
  if lower(new.email) = 'zentelinsight@gmail.com' then initial_role := 'admin'; end if;

  insert into public.jela_accounts(id, first_name, last_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'first_name', ''), coalesce(new.raw_user_meta_data ->> 'last_name', ''))
  on conflict (id) do nothing;
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

create or replace function public.set_jela_avatar_path(p_avatar_path text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_avatar_path is not null and (
    split_part(p_avatar_path, '/', 1) <> auth.uid()::text
    or p_avatar_path !~ '^[0-9a-f-]{36}/avatar\.(jpg|jpeg|png|webp)$'
  ) then raise exception 'invalid_avatar_path'; end if;
  update public.jela_accounts
  set avatar_path = p_avatar_path, avatar_url = null
  where id = auth.uid();
  return p_avatar_path;
end;
$$;

create or replace function public.get_my_jela_usage_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_wallet public.jela_credit_wallets;
  selected_plan public.jela_plans;
  selected_version public.jela_plan_versions;
  selected_subscription public.jela_subscriptions;
  reset_hours integer := 24;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into selected_wallet from public.jela_credit_wallets where user_id = auth.uid() for update;
  if selected_wallet.user_id is null then raise exception 'usage_state_unavailable'; end if;

  if selected_wallet.next_free_reset_at is not null and selected_wallet.next_free_reset_at <= now() then
    select * into selected_version from public.jela_plan_versions where id = selected_wallet.plan_version_id;
    select * into selected_plan from public.jela_plans where id = selected_version.plan_id;
    if selected_plan.code = 'free' then
      update public.jela_credit_wallets
      set balance = 60, reserved = 0, allowance = 60, exhausted_at = null,
          next_free_reset_at = null, period_started_at = now(), updated_at = now()
      where user_id = auth.uid()
      returning * into selected_wallet;
    end if;
  end if;

  select * into selected_version from public.jela_plan_versions where id = selected_wallet.plan_version_id;
  select * into selected_plan from public.jela_plans where id = selected_version.plan_id;
  select * into selected_subscription from public.jela_subscriptions
  where user_id = auth.uid() and status in ('trialing','active','past_due','grace_period')
  order by created_at desc limit 1;

  return jsonb_build_object(
    'plan_code', selected_plan.code,
    'plan_name', selected_plan.name,
    'price_minor', selected_version.price_minor,
    'currency', selected_version.currency,
    'billing_interval', selected_version.billing_interval,
    'usage_available', selected_wallet.balance - selected_wallet.reserved > 0,
    'can_send', selected_wallet.balance - selected_wallet.reserved > 0,
    'next_free_reset_at', selected_wallet.next_free_reset_at,
    'subscription_status', selected_subscription.status,
    'current_period_end', selected_subscription.current_period_end,
    'allowed_modes', jsonb_build_array('auto')
      || case when coalesce((selected_version.feature_config ->> 'deep_think')::boolean, false) then '["deep_think"]'::jsonb else '[]'::jsonb end
      || case when coalesce((selected_version.feature_config ->> 'research')::boolean, false) then '["research"]'::jsonb else '[]'::jsonb end,
    'features', selected_version.feature_config
  );
end;
$$;

create or replace function public.admin_update_jela_app_config(
  p_key text,
  p_value jsonb,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare old_value jsonb;
begin
  if not public.is_jela_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if char_length(trim(p_reason)) < 3 then raise exception 'reason_required'; end if;
  select value into old_value from public.jela_app_config where key = p_key;
  insert into public.jela_app_config(key, value, description)
  values (p_key, p_value, 'Admin-managed Jela configuration.')
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'config.updated', 'app_config', p_key,
    jsonb_build_object('old', old_value, 'new', p_value, 'reason', trim(p_reason)));
end;
$$;

create or replace function public.admin_set_jela_user_override(
  p_user_id uuid,
  p_use_plan_defaults boolean,
  p_override_config jsonb,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare old_value jsonb;
begin
  if not public.is_jela_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if jsonb_typeof(p_override_config) <> 'object' or char_length(trim(p_reason)) < 3 then raise exception 'invalid_override'; end if;
  select jsonb_build_object('use_plan_defaults', use_plan_defaults, 'override_config', override_config)
  into old_value from public.jela_user_ai_overrides where user_id = p_user_id;
  insert into public.jela_user_ai_overrides(user_id, use_plan_defaults, override_config, reason, updated_by)
  values (p_user_id, p_use_plan_defaults, p_override_config, trim(p_reason), auth.uid())
  on conflict (user_id) do update set
    use_plan_defaults = excluded.use_plan_defaults,
    override_config = excluded.override_config,
    reason = excluded.reason,
    updated_by = auth.uid(),
    updated_at = now();
  insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'account.ai_override_updated', 'account', p_user_id::text,
    jsonb_build_object('old', old_value, 'new', p_override_config, 'use_plan_defaults', p_use_plan_defaults, 'reason', trim(p_reason)));
end;
$$;

create or replace function public.admin_update_jela_plan_version(
  p_plan_id uuid,
  p_price_minor bigint,
  p_internal_allowance bigint,
  p_feature_config jsonb,
  p_rate_limits jsonb,
  p_purchasable boolean,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_version public.jela_plan_versions;
declare next_id uuid;
begin
  if not public.is_jela_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if p_price_minor < 0 or p_internal_allowance is not null and p_internal_allowance <= 0
    or jsonb_typeof(p_feature_config) <> 'object' or jsonb_typeof(p_rate_limits) <> 'object'
    or char_length(trim(p_reason)) < 3 then raise exception 'invalid_plan_configuration'; end if;
  select v.* into current_version from public.jela_plan_versions v
  join public.jela_plans p on p.current_version_id = v.id
  where p.id = p_plan_id for update;
  if current_version.id is null then raise exception 'plan_not_found'; end if;

  update public.jela_plan_versions set retired_at = now(), active = false where id = current_version.id;
  insert into public.jela_plan_versions(
    plan_id, version_number, price_minor, currency, billing_interval,
    internal_allowance, feature_config, rate_limits, provider_plan_code,
    purchasable, active
  ) values (
    p_plan_id, current_version.version_number + 1, p_price_minor,
    current_version.currency, current_version.billing_interval, p_internal_allowance,
    p_feature_config, p_rate_limits, current_version.provider_plan_code,
    p_purchasable, true
  ) returning id into next_id;
  update public.jela_plans set price_minor = p_price_minor, current_version_id = next_id, updated_at = now() where id = p_plan_id;
  insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'plan.version_created', 'plan', p_plan_id::text,
    jsonb_build_object('old_version', current_version.id, 'new_version', next_id, 'reason', trim(p_reason)));
  return next_id;
end;
$$;

-- Public view contains no hidden allowance, unit, model-cost, or provider-secret data.
create or replace view public.jela_public_plans
with (security_invoker = false)
as
select
  p.id, p.code, p.name, p.description, p.currency, p.price_minor,
  p.interval, p.public_features as features, p.most_popular, p.sort_order,
  v.purchasable
from public.jela_plans p
join public.jela_plan_versions v on v.id = p.current_version_id
where p.active and v.active;

alter table public.jela_plan_versions enable row level security;
alter table public.jela_user_settings enable row level security;
alter table public.jela_user_ai_overrides enable row level security;
alter table public.jela_trial_config enable row level security;
alter table public.jela_user_trials enable row level security;
alter table public.jela_payment_attempts enable row level security;
alter table public.jela_payment_events enable row level security;

drop policy if exists "Users read active plans and admins read all" on public.jela_plans;
create policy "Public reads active Jela plans"
on public.jela_plans for select to anon, authenticated
using (active or public.is_jela_admin());

create policy "Admins manage plan versions"
on public.jela_plan_versions for all to authenticated
using (public.is_jela_admin()) with check (public.is_jela_admin());
create policy "Users manage their own settings"
on public.jela_user_settings for all to authenticated
using (user_id = auth.uid() or public.is_jela_admin())
with check (user_id = auth.uid() or public.is_jela_admin());
create policy "Admins manage user AI overrides"
on public.jela_user_ai_overrides for all to authenticated
using (public.is_jela_admin()) with check (public.is_jela_admin());
create policy "Admins manage trial configuration"
on public.jela_trial_config for all to authenticated
using (public.is_jela_admin()) with check (public.is_jela_admin());
create policy "Users read their trials and admins manage all"
on public.jela_user_trials for select to authenticated
using (user_id = auth.uid() or public.is_jela_admin());
create policy "Admins manage trials"
on public.jela_user_trials for all to authenticated
using (public.is_jela_admin()) with check (public.is_jela_admin());
create policy "Users read their payment attempts"
on public.jela_payment_attempts for select to authenticated
using (user_id = auth.uid() or public.is_jela_admin());
create policy "Admins read payment events"
on public.jela_payment_events for select to authenticated
using (public.is_jela_admin());

drop policy if exists "Users read their wallet and admins read all" on public.jela_credit_wallets;
drop policy if exists "Users read their ledger and admins read all" on public.jela_credit_ledger;
drop policy if exists "Users read their usage and admins read all" on public.jela_ai_usage;
create policy "Only admins read internal wallets"
on public.jela_credit_wallets for select to authenticated using (public.is_jela_admin());
create policy "Only admins read internal ledger"
on public.jela_credit_ledger for select to authenticated using (public.is_jela_admin());
create policy "Only admins read internal AI usage"
on public.jela_ai_usage for select to authenticated using (public.is_jela_admin());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('jela-avatars', 'jela-avatars', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload only their avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'jela-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/avatar\.(jpg|jpeg|png|webp)$')
);
create policy "Users read only their avatar"
on storage.objects for select to authenticated
using (bucket_id = 'jela-avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "Users replace only their avatar"
on storage.objects for update to authenticated
using (bucket_id = 'jela-avatars' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'jela-avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "Users delete only their avatar"
on storage.objects for delete to authenticated
using (bucket_id = 'jela-avatars' and split_part(name, '/', 1) = auth.uid()::text);

grant select on public.jela_public_plans to anon, authenticated;
grant select on public.jela_plans to anon, authenticated;
grant select, insert, update, delete on public.jela_user_settings to authenticated;
grant select on public.jela_payment_attempts to authenticated;
grant all on public.jela_plan_versions, public.jela_user_ai_overrides,
  public.jela_trial_config, public.jela_user_trials, public.jela_payment_attempts,
  public.jela_payment_events to service_role;

revoke all on function public.set_jela_avatar_path(text) from public;
revoke all on function public.get_my_jela_usage_state() from public;
revoke all on function public.admin_update_jela_app_config(text, jsonb, text) from public;
revoke all on function public.admin_set_jela_user_override(uuid, boolean, jsonb, text) from public;
revoke all on function public.admin_update_jela_plan_version(uuid, bigint, bigint, jsonb, jsonb, boolean, text) from public;
grant execute on function public.set_jela_avatar_path(text) to authenticated;
grant execute on function public.get_my_jela_usage_state() to authenticated;
grant execute on function public.admin_update_jela_app_config(text, jsonb, text) to authenticated;
grant execute on function public.admin_set_jela_user_override(uuid, boolean, jsonb, text) to authenticated;
grant execute on function public.admin_update_jela_plan_version(uuid, bigint, bigint, jsonb, jsonb, boolean, text) to authenticated;

-- Realtime is intentionally scoped to user/account and configuration changes.
do $$ begin
  alter publication supabase_realtime add table public.jela_accounts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.jela_subscriptions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.jela_app_config;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.jela_user_settings;
exception when duplicate_object then null; end $$;

comment on table public.jela_plan_versions is 'Versioned commercial and hidden entitlement configuration. Internal allowances are never exposed to normal users.';
comment on table public.jela_payment_attempts is 'Backend-created Paystack attempts; client callbacks cannot fulfill value.';
comment on table public.jela_payment_events is 'Signature-validated Paystack webhook events with idempotent fingerprints.';
