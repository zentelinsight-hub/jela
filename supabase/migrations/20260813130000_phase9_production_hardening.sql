-- Phase 9 production hardening: authoritative periods, atomic file limits, rollout, diagnostics and retrieval controls.

alter table public.jela_ai_usage
  add column if not exists workspace_meter_id uuid references public.jela_usage_meters(id) on delete set null;

insert into public.jela_app_config(key,value,description) values
  ('memory_enabled','true'::jsonb,'Persistent, user-controlled Jela Memory is enabled.'),
  ('projects_enabled','true'::jsonb,'Persistent Jela Projects are enabled.'),
  ('workspace_files_enabled','true'::jsonb,'Private first-class workspace Files are enabled.'),
  ('memory_auto_save_enabled','true'::jsonb,'Useful-memory extraction may run server-side when the user opted in and the plan permits it.'),
  ('semantic_retrieval_enabled','true'::jsonb,'Semantic workspace retrieval is enabled.'),
  ('hybrid_retrieval_enabled','true'::jsonb,'Keyword and semantic workspace retrieval are combined.'),
  ('workspace_retrieval_top_k','8'::jsonb,'Maximum memories or file chunks selected per retrieval category.'),
  ('workspace_retrieval_min_rank','0.08'::jsonb,'Minimum combined retrieval rank.'),
  ('workspace_semantic_weight','0.62'::jsonb,'Semantic contribution to hybrid memory ranking.'),
  ('workspace_keyword_weight','0.23'::jsonb,'Keyword contribution to hybrid memory ranking.'),
  ('project_instructions_enabled','true'::jsonb,'Project-level persistent instructions are enabled.'),
  ('project_memory_enabled','true'::jsonb,'Project-isolated memory is enabled.'),
  ('file_analysis_enabled','true'::jsonb,'Supported workspace documents can be processed and searched.'),
  ('document_processing_enabled','true'::jsonb,'Asynchronous document extraction and embedding jobs are enabled.')
on conflict(key) do update set value=excluded.value,description=excluded.description,updated_at=now();

update public.jela_app_config set value='{"recent_messages":14,"summary_chars":6000,"memory_items":8,"memory_chars":6000,"file_chunks":8,"file_chars":12000,"project_instructions_chars":8000}'::jsonb,
  description='Bounded server-side context contributions for Jela workspace orchestration.',updated_at=now()
where key='workspace_context_budget';

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

  -- A paid wallet is only authoritative while backed by a confirmed current subscription/trial window.
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
    meter_period_start := date_trunc('day',now());
    meter_period_end := meter_period_start+interval '24 hours';
  end if;
  features := coalesce(version_row.feature_config,'{}'::jsonb);
  limits := coalesce(version_row.rate_limits,'{}'::jsonb);

  select * into account_override from public.jela_user_ai_overrides where user_id=p_user_id;
  if account_override.user_id is not null and not account_override.use_plan_defaults then
    features := features || coalesce(account_override.override_config->'features',account_override.override_config);
    limits := limits || coalesce(account_override.override_config->'limits','{}'::jsonb);
  end if;

  features := features || jsonb_build_object(
    'chat_enabled',coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='chat_enabled'),false),
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
    'project_memory_enabled',coalesce((select (value#>>'{}')::boolean from public.jela_app_config where key='project_memory_enabled'),false),
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

create or replace function public.create_jela_file_record(
  p_user_id uuid,p_file_id uuid,p_project_id uuid,p_original_name text,p_storage_path text,
  p_mime_type text,p_size_bytes bigint,p_storage_limit bigint,p_project_file_limit integer
)
returns public.jela_files
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare reservation jsonb; created public.jela_files; meter_start timestamptz; meter_end timestamptz;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_mime_type not in ('text/plain','application/pdf') or p_size_bytes<1 then raise exception 'invalid_file'; end if;
  perform pg_advisory_xact_lock(hashtextextended('jela-file:'||p_user_id::text||':'||coalesce(p_project_id::text,'global'),0));
  if p_project_id is not null then
    if not exists(select 1 from public.jela_projects where id=p_project_id and owner_id=p_user_id and deleted_at is null) then raise exception 'project_not_found'; end if;
    if (select count(*) from public.jela_files where owner_id=p_user_id and project_id=p_project_id and deleted_at is null)>=p_project_file_limit then
      raise exception 'project_file_limit_reached';
    end if;
  end if;
  meter_start:='2000-01-01T00:00:00Z'; meter_end:='2100-01-01T00:00:00Z';
  reservation:=public.reserve_jela_meter(p_user_id,'storage_bytes',p_size_bytes,p_storage_limit,meter_start,meter_end);
  if not coalesce((reservation->>'allowed')::boolean,false) then raise exception 'storage_bytes_limit_reached'; end if;
  insert into public.jela_files(
    id,owner_id,project_id,original_name,storage_path,mime_type,size_bytes,reserved_meter_id,reserved_bytes
  ) values (
    p_file_id,p_user_id,p_project_id,btrim(p_original_name),p_storage_path,p_mime_type,p_size_bytes,
    (reservation->>'meter_id')::uuid,p_size_bytes
  ) returning * into created;
  return created;
end;
$$;

revoke all on function public.create_jela_file_record(uuid,uuid,uuid,text,text,text,bigint,bigint,integer) from public,anon,authenticated;
grant execute on function public.create_jela_file_record(uuid,uuid,uuid,text,text,text,bigint,bigint,integer) to service_role;

create or replace function public.admin_jela_workspace_metrics()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select case when public.is_jela_admin(auth.uid()) then jsonb_build_object(
    'active_projects',(select count(*) from public.jela_projects where deleted_at is null and archived_at is null),
    'stored_files',(select count(*) from public.jela_files where deleted_at is null),
    'storage_bytes',(select coalesce(sum(size_bytes),0) from public.jela_files where deleted_at is null),
    'active_memories',(select count(*) from public.jela_memories where deleted_at is null),
    'generated_images',(select count(*) from public.jela_generated_images where status='ready'),
    'web_searches',(select coalesce(sum(web_search_count),0) from public.jela_ai_usage where status='complete'),
    'jobs',jsonb_build_object(
      'queued',(select count(*) from public.jela_workspace_jobs where status='queued'),
      'processing',(select count(*) from public.jela_workspace_jobs where status='processing'),
      'failed',(select count(*) from public.jela_workspace_jobs where status='failed')
    ),
    'embeddings',jsonb_build_object(
      'memory_ready',(select count(*) from public.jela_memories where deleted_at is null and embedding_status='ready'),
      'memory_failed',(select count(*) from public.jela_memories where deleted_at is null and embedding_status='failed'),
      'file_ready',(select count(*) from public.jela_document_chunks where embedding_status='ready'),
      'file_failed',(select count(*) from public.jela_document_chunks where embedding_status='failed')
    )
  ) else null end;
$$;
revoke all on function public.admin_jela_workspace_metrics() from public;
grant execute on function public.admin_jela_workspace_metrics() to authenticated;

create or replace function public.admin_update_jela_workspace_plan(
  p_plan_id uuid,p_feature_config jsonb,p_rate_limits jsonb,p_reason text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare plan_row public.jela_plans; current_version public.jela_plan_versions;
declare allowed_features constant text[]:=array['memory_enabled','auto_memory_enabled','projects_enabled','workspace_files_enabled','file_analysis_enabled','image_generation_enabled','research','deep_think','voice_enabled'];
declare allowed_limits constant text[]:=array['memory_item_limit','storage_bytes_limit','max_projects','image_generation_limit','web_search_limit','max_file_size','max_project_files'];
declare item record;
begin
  if not public.is_jela_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if jsonb_typeof(p_feature_config)<>'object' or jsonb_typeof(p_rate_limits)<>'object' or char_length(btrim(p_reason))<3 then raise exception 'invalid_configuration'; end if;
  for item in select key,value from jsonb_each(p_feature_config) loop
    if not item.key=any(allowed_features) or jsonb_typeof(item.value)<>'boolean' then raise exception 'invalid_feature'; end if;
  end loop;
  for item in select key,value from jsonb_each(p_rate_limits) loop
    if not item.key=any(allowed_limits) or jsonb_typeof(item.value)<>'number' or (item.value#>>'{}')::numeric<0 then raise exception 'invalid_limit'; end if;
  end loop;
  select * into plan_row from public.jela_plans where id=p_plan_id and active for update;
  if plan_row.id is null then raise exception 'plan_not_found'; end if;
  select * into current_version from public.jela_plan_versions where id=plan_row.current_version_id for update;
  if current_version.id is null then raise exception 'plan_version_not_found'; end if;
  p_rate_limits:=p_rate_limits||jsonb_build_object(
    'memory_item_limit',least(coalesce((p_rate_limits->>'memory_item_limit')::bigint,(current_version.rate_limits->>'memory_item_limit')::bigint),100000),
    'storage_bytes_limit',least(coalesce((p_rate_limits->>'storage_bytes_limit')::bigint,(current_version.rate_limits->>'storage_bytes_limit')::bigint),107374182400),
    'max_projects',least(coalesce((p_rate_limits->>'max_projects')::bigint,(current_version.rate_limits->>'max_projects')::bigint),10000),
    'image_generation_limit',least(coalesce((p_rate_limits->>'image_generation_limit')::bigint,(current_version.rate_limits->>'image_generation_limit')::bigint),100000),
    'web_search_limit',least(coalesce((p_rate_limits->>'web_search_limit')::bigint,(current_version.rate_limits->>'web_search_limit')::bigint),100000),
    'max_file_size',least(coalesce((p_rate_limits->>'max_file_size')::bigint,(current_version.rate_limits->>'max_file_size')::bigint),52428800),
    'max_project_files',least(coalesce((p_rate_limits->>'max_project_files')::bigint,(current_version.rate_limits->>'max_project_files')::bigint),10000)
  );
  -- Price/provider versions remain immutable; product entitlements are plan policy and update every retained version.
  update public.jela_plan_versions set
    feature_config=feature_config||p_feature_config,rate_limits=rate_limits||p_rate_limits,updated_at=now()
  where plan_id=plan_row.id;
  insert into public.jela_audit_logs(actor_id,action,target_type,target_id,metadata) values(
    auth.uid(),'plan.workspace_entitlements_updated','plan',plan_row.id::text,
    jsonb_build_object('price_version_unchanged',current_version.id,'feature_changes',p_feature_config,'limit_changes',p_rate_limits,'reason',btrim(p_reason))
  );
  return current_version.id;
end;
$$;
revoke all on function public.admin_update_jela_workspace_plan(uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.admin_update_jela_workspace_plan(uuid,jsonb,jsonb,text) to authenticated;

create or replace function public.admin_jela_account_workspace_state(p_user_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select case when public.is_jela_admin(auth.uid()) then jsonb_build_object(
    'entitlements',public.resolve_jela_entitlements(p_user_id),
    'override',(select jsonb_build_object('use_plan_defaults',use_plan_defaults,'override_config',override_config,'reason',reason,'updated_at',updated_at) from public.jela_user_ai_overrides where user_id=p_user_id),
    'workspace',jsonb_build_object(
      'projects',(select count(*) from public.jela_projects where owner_id=p_user_id and deleted_at is null),
      'memories',(select count(*) from public.jela_memories where owner_id=p_user_id and deleted_at is null),
      'files',(select count(*) from public.jela_files where owner_id=p_user_id and deleted_at is null),
      'storage_bytes',(select coalesce(sum(size_bytes),0) from public.jela_files where owner_id=p_user_id and deleted_at is null),
      'images',(select count(*) from public.jela_generated_images where owner_id=p_user_id and status='ready')
    )
  ) else null end;
$$;
revoke all on function public.admin_jela_account_workspace_state(uuid) from public,anon;
grant execute on function public.admin_jela_account_workspace_state(uuid) to authenticated;

create or replace function public.normalize_jela_wallet_entitlement(p_user_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare wallet_row public.jela_credit_wallets; plan_code text; free_version public.jela_plan_versions;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service_role_required'; end if;
  select wallet.* into wallet_row from public.jela_credit_wallets wallet where wallet.user_id=p_user_id for update;
  if wallet_row.user_id is null then raise exception 'usage_state_unavailable'; end if;
  select plan.code into plan_code from public.jela_plan_versions version join public.jela_plans plan on plan.id=version.plan_id
    where version.id=wallet_row.plan_version_id;
  if coalesce(plan_code,'free')<>'free' and not exists(
    select 1 from public.jela_subscriptions subscription where subscription.user_id=p_user_id
      and subscription.plan_version_id=wallet_row.plan_version_id
      and subscription.status in ('active','trialing','grace_period')
      and coalesce(subscription.current_period_start,subscription.created_at)<=now() and subscription.current_period_end>now()
      and (subscription.status<>'grace_period' or coalesce(subscription.grace_until,subscription.current_period_end)>now())
    union all
    select 1 from public.jela_user_trials trial where trial.user_id=p_user_id
      and trial.plan_version_id=wallet_row.plan_version_id and trial.status='active' and trial.starts_at<=now() and trial.ends_at>now()
  ) then
    select version.* into free_version from public.jela_plans plan join public.jela_plan_versions version
      on version.id=plan.current_version_id where plan.code='free' and plan.active limit 1;
    if free_version.id is null then raise exception 'free_plan_not_configured'; end if;
    update public.jela_credit_wallets set plan_version_id=free_version.id,balance=60,reserved=0,allowance=60,
      exhausted_at=null,next_free_reset_at=null,period_started_at=now(),updated_at=now() where user_id=p_user_id;
    insert into public.jela_audit_logs(actor_id,action,target_type,target_id,metadata) values(
      p_user_id,'entitlement.expired_paid_fallback','account',p_user_id::text,
      jsonb_build_object('from_plan',plan_code,'to_plan','free','old_plan_version',wallet_row.plan_version_id,'new_plan_version',free_version.id)
    );
    return 'free';
  end if;
  return coalesce(plan_code,'free');
end;
$$;
revoke all on function public.normalize_jela_wallet_entitlement(uuid) from public,anon,authenticated;
grant execute on function public.normalize_jela_wallet_entitlement(uuid) to service_role;

create or replace function public.search_jela_memories(
  p_user_id uuid,p_query text,p_embedding extensions.vector(1536),p_project_id uuid default null,
  p_conversation_id uuid default null,p_limit integer default 8
)
returns table(id uuid,scope public.jela_memory_scope,content text,category text,pinned boolean,rank real)
language sql stable security definer set search_path=public,extensions,pg_temp as $$
  with policy as (
    select
      coalesce((select (value#>>'{}')::real from public.jela_app_config where key='workspace_semantic_weight'),0.62) semantic_weight,
      coalesce((select (value#>>'{}')::real from public.jela_app_config where key='workspace_keyword_weight'),0.23) keyword_weight,
      coalesce((select (value#>>'{}')::real from public.jela_app_config where key='workspace_retrieval_min_rank'),0.08) min_rank
  ), ranked as (
    select memory.id,memory.scope,memory.content,memory.category,memory.pinned,
      ((case when p_embedding is not null and memory.embedding is not null then (1-(memory.embedding<=>p_embedding))*policy.semantic_weight else 0 end)
       +ts_rank_cd(to_tsvector('simple',memory.normalized_content),plainto_tsquery('simple',p_query))*policy.keyword_weight
       +case when memory.pinned then 0.10 else 0 end+memory.importance::real/200.0)::real rank,policy.min_rank
    from public.jela_memories memory cross join policy
    where memory.owner_id=p_user_id
      and (p_user_id=auth.uid() or coalesce(auth.jwt()->>'role','')='service_role')
      and (coalesce(auth.jwt()->>'role','')='service_role' or public.is_jela_session_verified())
      and memory.deleted_at is null and memory.embedding_status='ready'
      and (memory.scope='global' or (memory.scope='project' and p_project_id is not null and memory.project_id=p_project_id)
        or (memory.scope='conversation' and p_conversation_id is not null and memory.conversation_id=p_conversation_id))
  )
  select ranked.id,ranked.scope,ranked.content,ranked.category,ranked.pinned,ranked.rank
  from ranked where ranked.rank>=ranked.min_rank order by ranked.rank desc limit least(greatest(p_limit,1),20);
$$;

create or replace function public.search_jela_document_chunks(
  p_user_id uuid,p_query text,p_embedding extensions.vector(1536),p_project_id uuid default null,
  p_file_ids uuid[] default null,p_limit integer default 8
)
returns table(id uuid,file_id uuid,content text,metadata jsonb,rank real)
language sql stable security definer set search_path=public,extensions,pg_temp as $$
  with policy as (
    select coalesce((select (value#>>'{}')::real from public.jela_app_config where key='workspace_retrieval_min_rank'),0.08) min_rank
  ), ranked as (
    select chunk.id,chunk.file_id,chunk.content,chunk.metadata,
      ((case when p_embedding is not null and chunk.embedding is not null then (1-(chunk.embedding<=>p_embedding))*0.72 else 0 end)
       +ts_rank_cd(to_tsvector('simple',chunk.content),plainto_tsquery('simple',p_query))*0.28)::real rank,policy.min_rank
    from public.jela_document_chunks chunk join public.jela_files file on file.id=chunk.file_id
      and file.deleted_at is null and file.status='ready' cross join policy
    where chunk.owner_id=p_user_id and chunk.embedding_status='ready'
      and (p_user_id=auth.uid() or coalesce(auth.jwt()->>'role','')='service_role')
      and (coalesce(auth.jwt()->>'role','')='service_role' or public.is_jela_session_verified())
      and ((p_project_id is null and chunk.project_id is null) or (p_project_id is not null and (chunk.project_id is null or chunk.project_id=p_project_id)))
      and (p_file_ids is null or chunk.file_id=any(p_file_ids))
  )
  select ranked.id,ranked.file_id,ranked.content,ranked.metadata,ranked.rank from ranked
  where ranked.rank>=ranked.min_rank order by ranked.rank desc limit least(greatest(p_limit,1),20);
$$;
