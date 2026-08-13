-- Phase 9 final settings concurrency and per-user entitlement validation.

create or replace function public.set_jela_memory_settings(p_user_id uuid,p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare current_preferences jsonb; normalized jsonb;
begin
  if p_user_id is null or (p_user_id<>auth.uid() and coalesce(auth.jwt()->>'role','')<>'service_role') then
    raise exception 'access_denied';
  end if;
  if jsonb_typeof(p_settings)<>'object' then raise exception 'invalid_memory_settings'; end if;
  normalized:=jsonb_build_object(
    'enabled',coalesce((p_settings->>'enabled')::boolean,false),
    'remember_useful',coalesce((p_settings->>'remember_useful')::boolean,false),
    'reference_conversations',coalesce((p_settings->>'reference_conversations')::boolean,false),
    'project_memory',coalesce((p_settings->>'project_memory')::boolean,false),
    'onboarded',coalesce((p_settings->>'onboarded')::boolean,false)
  );
  perform pg_advisory_xact_lock(hashtextextended('jela-settings:'||p_user_id::text,0));
  select coalesce(ai_preferences,'{}'::jsonb) into current_preferences
  from public.jela_user_settings where user_id=p_user_id for update;
  insert into public.jela_user_settings(user_id,ai_preferences,updated_at)
  values(p_user_id,coalesce(current_preferences,'{}'::jsonb)||jsonb_build_object('memory',normalized),now())
  on conflict(user_id) do update set
    ai_preferences=coalesce(public.jela_user_settings.ai_preferences,'{}'::jsonb)||jsonb_build_object('memory',normalized),
    updated_at=now();
  return normalized;
end;
$$;

create or replace function public.set_my_jela_personalization(
  p_preferred_name text,p_response_style text,p_custom_instructions text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_user_id uuid:=auth.uid(); current_preferences jsonb; personalization jsonb;
begin
  if v_user_id is null or not public.is_jela_session_verified() then raise exception 'verified_session_required'; end if;
  personalization:=jsonb_build_object(
    'preferred_name',left(btrim(coalesce(p_preferred_name,'')),80),
    'response_style',left(btrim(coalesce(p_response_style,'')),80),
    'custom_instructions',left(btrim(coalesce(p_custom_instructions,'')),1200)
  );
  perform pg_advisory_xact_lock(hashtextextended('jela-settings:'||v_user_id::text,0));
  select coalesce(ai_preferences,'{}'::jsonb) into current_preferences
  from public.jela_user_settings where user_id=v_user_id for update;
  insert into public.jela_user_settings(user_id,ai_preferences,updated_at)
  values(v_user_id,coalesce(current_preferences,'{}'::jsonb)||personalization,now())
  on conflict(user_id) do update set
    ai_preferences=coalesce(public.jela_user_settings.ai_preferences,'{}'::jsonb)||personalization,
    updated_at=now();
  return personalization;
end;
$$;

create or replace function public.admin_set_jela_user_override(
  p_user_id uuid,p_use_plan_defaults boolean,p_override_config jsonb,p_reason text
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  old_value jsonb;
  feature_payload jsonb;
  limit_payload jsonb;
  normalized jsonb;
  entry record;
  allowed_features constant text[]:=array[
    'chat_enabled','memory_enabled','auto_memory_enabled','projects_enabled','workspace_files_enabled',
    'file_analysis_enabled','project_memory_enabled','project_instructions_enabled','image_generation_enabled',
    'research','deep_think','voice_enabled','attachments','files','images','streaming'
  ];
  allowed_limits constant text[]:=array[
    'memory_item_limit','storage_bytes_limit','max_projects','image_generation_limit','web_search_limit',
    'max_file_size','max_project_files'
  ];
begin
  if not public.is_jela_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if jsonb_typeof(p_override_config)<>'object' or char_length(trim(p_reason))<3 then raise exception 'invalid_override'; end if;
  if not exists(select 1 from public.jela_accounts where id=p_user_id) then raise exception 'account_not_found'; end if;
  if p_use_plan_defaults then
    normalized:='{}'::jsonb;
  else
    feature_payload:=coalesce(p_override_config->'features',p_override_config-'features'-'limits');
    limit_payload:=coalesce(p_override_config->'limits','{}'::jsonb);
    if jsonb_typeof(feature_payload)<>'object' or jsonb_typeof(limit_payload)<>'object' then raise exception 'invalid_override'; end if;
    for entry in select key,value from jsonb_each(feature_payload) loop
      if not (entry.key=any(allowed_features)) or jsonb_typeof(entry.value)<>'boolean' then raise exception 'invalid_feature_override'; end if;
    end loop;
    for entry in select key,value from jsonb_each(limit_payload) loop
      if not (entry.key=any(allowed_limits)) or jsonb_typeof(entry.value)<>'number' or (entry.value#>>'{}')::numeric<0 then
        raise exception 'invalid_limit_override';
      end if;
      if entry.key='storage_bytes_limit' and (entry.value#>>'{}')::numeric>107374182400 then raise exception 'unsafe_limit_override'; end if;
      if entry.key='max_file_size' and (entry.value#>>'{}')::numeric>104857600 then raise exception 'unsafe_limit_override'; end if;
      if entry.key not in ('storage_bytes_limit','max_file_size') and (entry.value#>>'{}')::numeric>100000 then raise exception 'unsafe_limit_override'; end if;
    end loop;
    -- Flat feature keys retain compatibility with the existing atomic chat RPC; nested keys power the central resolver.
    normalized:=feature_payload||jsonb_build_object('features',feature_payload,'limits',limit_payload);
  end if;
  select jsonb_build_object('use_plan_defaults',use_plan_defaults,'override_config',override_config)
  into old_value from public.jela_user_ai_overrides where user_id=p_user_id;
  insert into public.jela_user_ai_overrides(user_id,use_plan_defaults,override_config,reason,updated_by)
  values(p_user_id,p_use_plan_defaults,normalized,trim(p_reason),auth.uid())
  on conflict(user_id) do update set use_plan_defaults=excluded.use_plan_defaults,override_config=excluded.override_config,
    reason=excluded.reason,updated_by=auth.uid(),updated_at=now();
  insert into public.jela_audit_logs(actor_id,action,target_type,target_id,metadata)
  values(auth.uid(),'account.ai_override_updated','account',p_user_id::text,
    jsonb_build_object('old',old_value,'new',normalized,'use_plan_defaults',p_use_plan_defaults,'reason',trim(p_reason)));
end;
$$;

revoke all on function public.set_jela_memory_settings(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.set_jela_memory_settings(uuid,jsonb) to service_role;
revoke all on function public.set_my_jela_personalization(text,text,text) from public,anon;
grant execute on function public.set_my_jela_personalization(text,text,text) to authenticated;
