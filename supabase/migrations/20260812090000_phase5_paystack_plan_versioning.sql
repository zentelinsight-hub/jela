-- Phase 5: keep Paystack plan pricing aligned with immutable Jela plan versions.
-- Only the service role may publish a provider-backed version after an Admin request.

update public.jela_plan_versions v
set internal_allowance = case p.code
  when 'starter' then 500
  when 'plus' then 1500
  when 'pro' then 4000
  else v.internal_allowance
end,
updated_at = now()
from public.jela_plans p
where p.current_version_id = v.id
  and p.code in ('starter', 'plus', 'pro')
  and v.internal_allowance is null;

create or replace function public.service_create_jela_plan_version(
  p_actor_id uuid,
  p_plan_id uuid,
  p_price_minor bigint,
  p_provider_plan_code text,
  p_internal_allowance bigint,
  p_feature_config jsonb,
  p_rate_limits jsonb,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_version public.jela_plan_versions;
declare selected_plan public.jela_plans;
declare next_id uuid;
begin
  if not public.is_jela_admin(p_actor_id) then raise exception 'admin_required'; end if;
  if p_price_minor <= 0 or p_internal_allowance <= 0
    or nullif(trim(p_provider_plan_code), '') is null
    or jsonb_typeof(p_feature_config) <> 'object'
    or jsonb_typeof(p_rate_limits) <> 'object'
    or char_length(trim(p_reason)) < 3 then raise exception 'invalid_plan_configuration'; end if;

  select * into selected_plan from public.jela_plans where id = p_plan_id for update;
  if selected_plan.id is null or selected_plan.code = 'free' or not selected_plan.active then
    raise exception 'plan_not_found';
  end if;
  select * into current_version from public.jela_plan_versions where id = selected_plan.current_version_id for update;
  if current_version.id is null then raise exception 'plan_version_not_found'; end if;

  update public.jela_plan_versions
  set retired_at = now(), active = false, updated_at = now()
  where id = current_version.id;

  insert into public.jela_plan_versions(
    plan_id, version_number, price_minor, currency, billing_interval,
    internal_allowance, feature_config, rate_limits, provider_plan_code,
    purchasable, active
  ) values (
    p_plan_id, current_version.version_number + 1, p_price_minor,
    current_version.currency, current_version.billing_interval, p_internal_allowance,
    p_feature_config, p_rate_limits, trim(p_provider_plan_code), true, true
  ) returning id into next_id;

  update public.jela_plans
  set price_minor = p_price_minor, current_version_id = next_id, updated_at = now()
  where id = p_plan_id;

  insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (p_actor_id, 'plan.provider_version_created', 'plan', p_plan_id::text,
    jsonb_build_object(
      'old_version', current_version.id,
      'new_version', next_id,
      'provider_plan_configured', true,
      'reason', trim(p_reason)
    ));
  return next_id;
end;
$$;

revoke all on function public.service_create_jela_plan_version(uuid, uuid, bigint, text, bigint, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.service_create_jela_plan_version(uuid, uuid, bigint, text, bigint, jsonb, jsonb, text) to service_role;

comment on function public.service_create_jela_plan_version(uuid, uuid, bigint, text, bigint, jsonb, jsonb, text)
is 'Server-only immutable Jela/Paystack plan version publisher. Existing subscriptions retain their original plan_version_id.';
