-- Phase 9 final hardening: rolling Free meters and strict entitlement precedence.

create or replace function public.reserve_jela_meter_window(
  p_user_id uuid,
  p_meter_key text,
  p_amount bigint,
  p_limit bigint,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_rolling boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meter public.jela_usage_meters;
  selected_start timestamptz := p_period_start;
  selected_end timestamptz := p_period_end;
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_amount <= 0 or p_limit < 0 then raise exception 'invalid_meter_request'; end if;

  perform pg_advisory_xact_lock(hashtextextended('jela-meter:' || p_user_id::text || ':' || p_meter_key, 0));
  if p_rolling then
    select * into meter
    from public.jela_usage_meters
    where owner_id=p_user_id and meter_key=p_meter_key and period_end>now()
    order by period_end desc
    limit 1
    for update;
    if meter.id is null then
      selected_start := now();
      selected_end := selected_start + interval '24 hours';
    else
      selected_start := meter.period_start;
      selected_end := meter.period_end;
    end if;
  end if;
  if selected_start is null or selected_end is null or selected_end <= selected_start then raise exception 'invalid_meter_request'; end if;

  if meter.id is null then
    insert into public.jela_usage_meters(owner_id,meter_key,period_start,period_end)
    values(p_user_id,p_meter_key,selected_start,selected_end)
    on conflict(owner_id,meter_key,period_start) do nothing;
    select * into meter from public.jela_usage_meters
    where owner_id=p_user_id and meter_key=p_meter_key and period_start=selected_start
    for update;
  end if;
  if meter.used + meter.reserved + p_amount > p_limit then
    return jsonb_build_object(
      'allowed',false,'used',meter.used,'reserved',meter.reserved,'limit',p_limit,
      'period_start',meter.period_start,'period_end',meter.period_end
    );
  end if;
  update public.jela_usage_meters
  set reserved=reserved+p_amount,updated_at=now()
  where id=meter.id
  returning * into meter;
  return jsonb_build_object(
    'allowed',true,'meter_id',meter.id,'used',meter.used,'reserved',meter.reserved,'limit',p_limit,
    'period_start',meter.period_start,'period_end',meter.period_end
  );
end;
$$;

revoke all on function public.reserve_jela_meter_window(uuid,text,bigint,bigint,timestamptz,timestamptz,boolean) from public;
grant execute on function public.reserve_jela_meter_window(uuid,text,bigint,bigint,timestamptz,timestamptz,boolean) to service_role;

create or replace function public.resolve_jela_entitlements(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  plan_code text := 'free';
  features jsonb := '{}'::jsonb;
  limits jsonb := '{}'::jsonb;
  account_override public.jela_user_ai_overrides;
  version_row public.jela_plan_versions;
  wallet_row public.jela_credit_wallets;
  subscription_row public.jela_subscriptions;
  trial_row public.jela_user_trials;
  meter_period_start timestamptz;
  meter_period_end timestamptz;
  global_ai boolean;
  global_chat boolean;
  maintenance boolean;
begin
  if p_user_id is null then raise exception 'authentication_required'; end if;
  if p_user_id <> auth.uid() and not public.is_jela_admin(auth.uid()) and coalesce(auth.jwt() ->> 'role','') <> 'service_role' then
    raise exception 'access_denied';
  end if;

  select * into wallet_row from public.jela_credit_wallets where user_id=p_user_id;
  select version.* into version_row from public.jela_plan_versions version where version.id=wallet_row.plan_version_id;
  if version_row.id is not null then
    select plan.code into plan_code from public.jela_plans plan where plan.id=version_row.plan_id;
  end if;

  if coalesce(plan_code,'free') <> 'free' then
    select * into subscription_row from public.jela_subscriptions subscription
    where subscription.user_id=p_user_id
      and subscription.plan_version_id=version_row.id
      and subscription.status in ('active','trialing','grace_period')
      and coalesce(subscription.current_period_start,subscription.created_at)<=now()
      and subscription.current_period_end>now()
      and (subscription.status<>'grace_period' or coalesce(subscription.grace_until,subscription.current_period_end)>now())
    order by subscription.current_period_end desc limit 1;
    if subscription_row.id is null then
      select * into trial_row from public.jela_user_trials trial
      where trial.user_id=p_user_id and trial.plan_version_id=version_row.id
        and trial.status='active' and trial.starts_at<=now() and trial.ends_at>now()
      order by trial.ends_at desc limit 1;
    end if;
    if subscription_row.id is null and trial_row.id is null then
      select version.* into version_row from public.jela_plans plan
      join public.jela_plan_versions version on version.id=plan.current_version_id
      where plan.code='free' and plan.active limit 1;
      plan_code := 'free';
    else
      meter_period_start := coalesce(subscription_row.current_period_start,trial_row.starts_at,now());
      meter_period_end := coalesce(subscription_row.current_period_end,trial_row.ends_at,now()+interval '24 hours');
    end if;
  end if;

  if coalesce(plan_code,'free')='free' then
    -- The reservation RPC owns the exact rolling window. These values describe the policy to clients.
    meter_period_start := now();
    meter_period_end := meter_period_start+interval '24 hours';
  end if;
  features := coalesce(version_row.feature_config,'{}'::jsonb);
  limits := coalesce(version_row.rate_limits,'{}'::jsonb);

  select * into account_override from public.jela_user_ai_overrides where user_id=p_user_id;
  if account_override.user_id is not null and not account_override.use_plan_defaults then
    features := features || coalesce(account_override.override_config->'features',account_override.override_config);
    limits := limits || coalesce(account_override.override_config->'limits','{}'::jsonb);
  end if;

  global_ai := coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='global_ai_enabled'),false);
  global_chat := coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='chat_enabled'),false);
  maintenance := coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='ai_maintenance_mode'),false);
  features := features || jsonb_build_object(
    'chat_enabled',coalesce((features->>'chat_enabled')::boolean,true) and global_ai and global_chat and not maintenance,
    'memory_enabled',coalesce((features->>'memory_enabled')::boolean,true)
      and coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='memory_enabled'),false),
    'auto_memory_enabled',coalesce((features->>'auto_memory_enabled')::boolean,false)
      and coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='memory_auto_save_enabled'),false),
    'projects_enabled',coalesce((features->>'projects_enabled')::boolean,true)
      and coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='projects_enabled'),false),
    'workspace_files_enabled',coalesce((features->>'workspace_files_enabled')::boolean,true)
      and coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='workspace_files_enabled'),false),
    'file_analysis_enabled',coalesce((features->>'file_analysis_enabled')::boolean,true)
      and coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='file_analysis_enabled'),false),
    'document_processing_enabled',coalesce((features->>'file_analysis_enabled')::boolean,true)
      and coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='document_processing_enabled'),false),
    'project_memory_enabled',coalesce((features->>'project_memory_enabled')::boolean,true)
      and coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='project_memory_enabled'),false),
    'image_generation_enabled',coalesce((features->>'image_generation_enabled')::boolean,true)
      and coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='image_generation_enabled'),false),
    'research_enabled',coalesce((features->>'research')::boolean,false)
      and coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='research_enabled'),false)
  );
  limits := jsonb_build_object(
    'memory_item_limit',case plan_code when 'pro' then 1000 when 'plus' then 300 when 'starter' then 100 else 30 end,
    'storage_bytes_limit',case plan_code when 'pro' then 10737418240 when 'plus' then 2147483648 when 'starter' then 536870912 else 104857600 end,
    'max_projects',case plan_code when 'pro' then 100 when 'plus' then 30 when 'starter' then 10 else 3 end,
    'image_generation_limit',case plan_code when 'pro' then 500 when 'plus' then 150 when 'starter' then 50 else 8 end,
    'web_search_limit',case plan_code when 'pro' then 1000 when 'plus' then 300 when 'starter' then 100 else 10 end,
    'max_file_size',case plan_code when 'pro' then 52428800 when 'plus' then 26214400 else 10485760 end,
    'max_project_files',case plan_code when 'pro' then 500 when 'plus' then 150 when 'starter' then 50 else 10 end
  ) || limits;
  return jsonb_build_object(
    'plan_code',plan_code,'features',features,'limits',limits,
    'meter_period',jsonb_build_object('start',meter_period_start,'end',meter_period_end)
  );
end;
$$;

