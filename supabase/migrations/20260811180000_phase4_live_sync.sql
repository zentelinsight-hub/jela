-- Phase 4: scoped Realtime reconciliation, versioned avatars, and safe client state.

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
    or p_avatar_path !~ '^[0-9a-f-]{36}/avatars/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  ) then raise exception 'invalid_avatar_path'; end if;

  update public.jela_accounts
  set avatar_path = p_avatar_path, avatar_url = null, updated_at = now()
  where id = auth.uid();
  return p_avatar_path;
end;
$$;

drop policy if exists "Users upload only their avatar" on storage.objects;
drop policy if exists "Users read only their avatar" on storage.objects;
drop policy if exists "Users replace only their avatar" on storage.objects;
drop policy if exists "Users delete only their avatar" on storage.objects;

create policy "Users upload only versioned avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'jela-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/avatars/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
);

create policy "Users read only their avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'jela-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/avatars/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
);

create policy "Users replace only versioned avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'jela-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/avatars/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
)
with check (
  bucket_id = 'jela-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/avatars/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
);

create policy "Users delete only versioned avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'jela-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/avatars/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
);

create or replace function public.touch_jela_account_for_override()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.jela_accounts set updated_at = now()
  where id = coalesce(new.user_id, old.user_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists touch_jela_account_for_override on public.jela_user_ai_overrides;
create trigger touch_jela_account_for_override
after insert or update or delete on public.jela_user_ai_overrides
for each row execute function public.touch_jela_account_for_override();

insert into public.jela_app_config(key, value, description)
values ('ai_configuration_revision', to_jsonb(extract(epoch from now())::bigint),
  'Opaque revision used to reconcile safe client capability state after model configuration changes.')
on conflict (key) do nothing;

create or replace function public.bump_jela_ai_configuration_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.jela_app_config(key, value, description, updated_at)
  values (
    'ai_configuration_revision',
    to_jsonb(extract(epoch from clock_timestamp())::numeric),
    'Opaque revision used to reconcile safe client capability state after model configuration changes.',
    now()
  )
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return null;
end;
$$;

drop trigger if exists bump_jela_ai_configuration_revision on public.jela_model_config;
create trigger bump_jela_ai_configuration_revision
after insert or update or delete on public.jela_model_config
for each statement execute function public.bump_jela_ai_configuration_revision();

create or replace function public.get_my_jela_usage_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_account public.jela_accounts;
  selected_wallet public.jela_credit_wallets;
  selected_plan public.jela_plans;
  selected_version public.jela_plan_versions;
  selected_subscription public.jela_subscriptions;
  selected_override public.jela_user_ai_overrides;
  effective_features jsonb := '{}'::jsonb;
  global_ai_enabled boolean := false;
  chat_enabled boolean := false;
  maintenance_mode boolean := false;
  has_balance boolean := false;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select * into selected_account from public.jela_accounts where id = auth.uid();
  select * into selected_wallet from public.jela_credit_wallets where user_id = auth.uid() for update;
  if selected_account.id is null or selected_wallet.user_id is null then
    raise exception 'usage_state_unavailable';
  end if;

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
  select * into selected_override from public.jela_user_ai_overrides where user_id = auth.uid();
  select * into selected_subscription from public.jela_subscriptions
  where user_id = auth.uid() and status in ('trialing','active','past_due','grace_period')
  order by created_at desc limit 1;

  effective_features := coalesce(selected_version.feature_config, '{}'::jsonb);
  if selected_override.user_id is not null and not selected_override.use_plan_defaults then
    effective_features := effective_features || selected_override.override_config;
  end if;

  global_ai_enabled := coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'global_ai_enabled'), false);
  chat_enabled := coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'chat_enabled'), false);
  maintenance_mode := coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'ai_maintenance_mode'), false);
  has_balance := selected_wallet.balance - selected_wallet.reserved > 0;

  return jsonb_build_object(
    'plan_code', selected_plan.code,
    'plan_name', selected_plan.name,
    'price_minor', selected_version.price_minor,
    'currency', selected_version.currency,
    'billing_interval', selected_version.billing_interval,
    'usage_available', has_balance,
    'can_send', has_balance and selected_account.status = 'active' and global_ai_enabled and chat_enabled and not maintenance_mode,
    'next_free_reset_at', selected_wallet.next_free_reset_at,
    'subscription_status', selected_subscription.status,
    'current_period_end', selected_subscription.current_period_end,
    'allowed_modes', jsonb_build_array('auto')
      || case when coalesce((effective_features ->> 'deep_think')::boolean, false) then '["deep_think"]'::jsonb else '[]'::jsonb end
      || case when coalesce((effective_features ->> 'research')::boolean, false) then '["research"]'::jsonb else '[]'::jsonb end,
    'features', jsonb_build_object(
      'attachments', coalesce((effective_features ->> 'attachments')::boolean, false),
      'deep_think', coalesce((effective_features ->> 'deep_think')::boolean, false),
      'images', coalesce((effective_features ->> 'images')::boolean, false),
      'memory', coalesce((effective_features ->> 'memory')::boolean, false),
      'research', coalesce((effective_features ->> 'research')::boolean, false),
      'streaming', coalesce((effective_features ->> 'streaming')::boolean, false),
      'voice', coalesce((effective_features ->> 'voice')::boolean, false)
    )
  );
end;
$$;

revoke all on function public.set_jela_avatar_path(text) from public;
revoke all on function public.get_my_jela_usage_state() from public;
revoke all on function public.touch_jela_account_for_override() from public;
revoke all on function public.bump_jela_ai_configuration_revision() from public;
grant execute on function public.set_jela_avatar_path(text) to authenticated;
grant execute on function public.get_my_jela_usage_state() to authenticated;

-- Realtime publication never bypasses table grants or row-level security.
do $$ begin alter publication supabase_realtime add table public.jela_conversations;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.jela_messages;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.jela_attachments;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.jela_plans;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.jela_billing_records;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.jela_payment_attempts;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.jela_ai_releases;
exception when duplicate_object then null; end $$;

comment on function public.set_jela_avatar_path(text) is
  'Atomically switches a user to a private, immutable, versioned avatar object.';
comment on function public.get_my_jela_usage_state() is
  'Returns a safe effective entitlement snapshot without exposing hidden allowances or model configuration.';
