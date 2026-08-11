-- Jela AI Phase 3: atomic usage enforcement and idempotent Paystack settlement.

create or replace function public.begin_jela_chat_request(
  p_user_id uuid,
  p_request_id uuid,
  p_conversation_id uuid,
  p_message text,
  p_mode text default 'auto',
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
  selected_plan public.jela_plans;
  selected_version public.jela_plan_versions;
  selected_usage public.jela_ai_usage;
  selected_conversation public.jela_conversations;
  selected_override public.jela_user_ai_overrides;
  effective_features jsonb := '{}'::jsonb;
  selected_reserve bigint;
  available_units bigint;
  user_message_id uuid;
  assistant_message_id uuid;
  assistant_content text;
  expected_attachments integer := coalesce(array_length(p_attachment_ids, 1), 0);
  valid_attachments integer := 0;
  requested_mode text := case when p_mode in ('auto','deep_think','research') then p_mode else 'auto' end;
begin
  if char_length(trim(p_message)) not between 1 and 8000 then raise exception 'invalid_message'; end if;

  select * into selected_account from public.jela_accounts where id = p_user_id;
  if selected_account.id is null then raise exception 'account_not_found'; end if;
  if selected_account.status <> 'active' then raise exception 'account_unavailable'; end if;
  if not coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'global_ai_enabled'), false)
    or not coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'chat_enabled'), false)
  then raise exception 'chat_not_enabled'; end if;
  if coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'ai_maintenance_mode'), false)
  then raise exception 'ai_maintenance'; end if;

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
  end if;

  select * into selected_wallet from public.jela_credit_wallets
  where user_id = p_user_id for update;
  if selected_wallet.user_id is null then raise exception 'usage_state_unavailable'; end if;

  select * into selected_version from public.jela_plan_versions where id = selected_wallet.plan_version_id;
  select * into selected_plan from public.jela_plans where id = selected_version.plan_id;
  if selected_plan.id is null then raise exception 'plan_not_configured'; end if;

  if selected_plan.code = 'free'
    and selected_wallet.next_free_reset_at is not null
    and selected_wallet.next_free_reset_at <= now()
  then
    update public.jela_credit_wallets
    set balance = 60, reserved = 0, allowance = 60, exhausted_at = null,
        next_free_reset_at = null, period_started_at = now(), updated_at = now()
    where user_id = p_user_id returning * into selected_wallet;
  end if;

  select * into selected_override from public.jela_user_ai_overrides where user_id = p_user_id;
  effective_features := selected_version.feature_config;
  if selected_override.user_id is not null and not selected_override.use_plan_defaults then
    effective_features := effective_features || selected_override.override_config;
  end if;

  if requested_mode = 'deep_think' and not coalesce((effective_features ->> 'deep_think')::boolean, false)
  then raise exception 'mode_not_available'; end if;
  if requested_mode = 'research' and (
    not coalesce((effective_features ->> 'research')::boolean, false)
    or not coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'research_enabled'), false)
  ) then raise exception 'mode_not_available'; end if;

  select * into selected_model from public.jela_model_config
  where enabled and mode = requested_mode and selected_plan.code = any(active_for_plans)
  limit 1;
  if selected_model.id is null and requested_mode <> 'auto' then
    raise exception 'model_not_configured';
  elsif selected_model.id is null then
    select * into selected_model from public.jela_model_config
    where enabled and mode = 'auto' and selected_plan.code = any(active_for_plans)
    limit 1;
  end if;
  if selected_model.id is null then raise exception 'model_not_configured'; end if;

  if expected_attachments > 0 then
    if not coalesce((effective_features ->> 'files')::boolean, false)
      or not coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key = 'attachments_enabled'), false)
    then raise exception 'attachments_not_enabled'; end if;
    if expected_attachments > 5 then raise exception 'too_many_attachments'; end if;
    select count(*) into valid_attachments from public.jela_attachments
    where id = any(p_attachment_ids) and owner_id = p_user_id and status = 'ready';
    if valid_attachments <> expected_attachments then raise exception 'invalid_attachment'; end if;
  end if;

  available_units := selected_wallet.balance - selected_wallet.reserved;
  if available_units <= 0 then raise exception 'usage_limit_reached'; end if;
  selected_reserve := least(selected_model.request_credit_reserve, available_units);

  if selected_usage.id is not null then
    update public.jela_credit_wallets set reserved = reserved + selected_reserve where user_id = p_user_id;
    update public.jela_ai_usage
    set status = 'processing', credits_reserved = selected_reserve, credits_charged = 0,
        error_code = null, error_message = null, completed_at = null, started_at = now(),
        mode = requested_mode, reasoning_effort = selected_model.reasoning_effort,
        effective_config = jsonb_build_object('plan_code', selected_plan.code, 'features', effective_features)
    where id = selected_usage.id;
    update public.jela_messages set content = '', status = 'streaming', error_code = null
    where id = assistant_message_id;
    return jsonb_build_object(
      'replay', false, 'status', 'processing',
      'conversation_id', selected_usage.conversation_id,
      'user_message_id', user_message_id, 'assistant_message_id', assistant_message_id,
      'provider', selected_model.provider, 'model', selected_model.model,
      'mode', requested_mode, 'system_prompt', selected_model.system_prompt,
      'reasoning_effort', selected_model.reasoning_effort,
      'tools', selected_model.tools,
      'max_output_tokens', selected_model.max_output_tokens
    );
  end if;

  if p_conversation_id is null then
    insert into public.jela_conversations(owner_id, title)
    values (p_user_id, left(regexp_replace(trim(p_message), '\s+', ' ', 'g'), 80))
    returning * into selected_conversation;
  else
    select * into selected_conversation from public.jela_conversations
    where id = p_conversation_id and owner_id = p_user_id and archived_at is null for update;
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

  update public.jela_credit_wallets set reserved = reserved + selected_reserve where user_id = p_user_id;
  insert into public.jela_ai_usage(
    request_id, user_id, conversation_id, model_config_id, model,
    plan_version_id, mode, reasoning_effort, credits_reserved, status, effective_config
  ) values (
    p_request_id, p_user_id, selected_conversation.id, selected_model.id, selected_model.model,
    selected_version.id, requested_mode, selected_model.reasoning_effort, selected_reserve, 'processing',
    jsonb_build_object('plan_code', selected_plan.code, 'features', effective_features)
  );
  update public.jela_conversations set updated_at = now() where id = selected_conversation.id;

  return jsonb_build_object(
    'replay', false, 'status', 'processing',
    'conversation_id', selected_conversation.id,
    'user_message_id', user_message_id, 'assistant_message_id', assistant_message_id,
    'provider', selected_model.provider, 'model', selected_model.model,
    'mode', requested_mode, 'system_prompt', selected_model.system_prompt,
    'reasoning_effort', selected_model.reasoning_effort,
    'tools', selected_model.tools,
    'max_output_tokens', selected_model.max_output_tokens
  );
end;
$$;

create or replace function public.complete_jela_chat_request(
  p_user_id uuid,
  p_request_id uuid,
  p_content text,
  p_input_tokens integer,
  p_cached_input_tokens integer,
  p_output_tokens integer,
  p_provider_request_id text,
  p_tool_calls jsonb,
  p_web_search_count integer,
  p_file_operation_count integer,
  p_image_operation_count integer,
  p_duration_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_usage public.jela_ai_usage;
  selected_model public.jela_model_config;
  selected_plan public.jela_plans;
  computed_charge bigint;
  estimated_cost bigint;
  next_balance bigint;
  next_reset timestamptz;
begin
  select * into selected_usage from public.jela_ai_usage
  where request_id = p_request_id and user_id = p_user_id for update;
  if selected_usage.id is null then raise exception 'request_not_found'; end if;
  if selected_usage.status = 'complete' then
    select next_free_reset_at into next_reset from public.jela_credit_wallets where user_id = p_user_id;
    return jsonb_build_object('charged', selected_usage.credits_charged, 'next_free_reset_at', next_reset);
  end if;
  if selected_usage.status <> 'processing' then raise exception 'request_not_processing'; end if;
  if char_length(p_content) = 0 or char_length(p_content) > 200000 then raise exception 'invalid_response'; end if;
  if least(p_input_tokens, p_cached_input_tokens, p_output_tokens, p_web_search_count,
    p_file_operation_count, p_image_operation_count, p_duration_ms) < 0
  then raise exception 'invalid_usage'; end if;
  if p_cached_input_tokens > p_input_tokens or jsonb_typeof(p_tool_calls) <> 'array' then raise exception 'invalid_usage'; end if;

  select * into selected_model from public.jela_model_config where id = selected_usage.model_config_id;
  computed_charge := least(
    selected_usage.credits_reserved,
    greatest(1, ceil((p_input_tokens::numeric / 1000) * selected_model.input_credit_cost
      + (p_output_tokens::numeric / 1000) * selected_model.output_credit_cost)::bigint)
  );
  estimated_cost := ceil(
    greatest(p_input_tokens - p_cached_input_tokens, 0) * coalesce(selected_model.provider_input_usd_per_million, 0)
    + p_cached_input_tokens * coalesce(selected_model.provider_cached_input_usd_per_million, selected_model.provider_input_usd_per_million, 0)
    + p_output_tokens * coalesce(selected_model.provider_output_usd_per_million, 0)
  )::bigint;

  select p.* into selected_plan
  from public.jela_plans p
  join public.jela_plan_versions v on v.plan_id = p.id
  where v.id = selected_usage.plan_version_id;

  update public.jela_credit_wallets
  set reserved = reserved - selected_usage.credits_reserved,
      balance = balance - computed_charge,
      lifetime_used = lifetime_used + computed_charge,
      exhausted_at = case when balance - computed_charge = 0 then now() else exhausted_at end,
      next_free_reset_at = case
        when selected_plan.code = 'free' and balance - computed_charge = 0 then now() + interval '24 hours'
        else next_free_reset_at end,
      updated_at = now()
  where user_id = p_user_id
  returning balance, next_free_reset_at into next_balance, next_reset;

  update public.jela_messages
  set content = p_content, status = 'complete', error_code = null
  where owner_id = p_user_id and request_id = p_request_id and role = 'assistant';
  update public.jela_ai_usage
  set input_tokens = p_input_tokens,
      cached_input_tokens = p_cached_input_tokens,
      output_tokens = p_output_tokens,
      credits_charged = computed_charge,
      provider_request_id = left(p_provider_request_id, 200),
      tool_calls = p_tool_calls,
      web_search_count = p_web_search_count,
      file_operation_count = p_file_operation_count,
      image_operation_count = p_image_operation_count,
      duration_ms = p_duration_ms,
      provider_estimated_cost_microusd = estimated_cost,
      status = 'complete', completed_at = now()
  where id = selected_usage.id;
  insert into public.jela_credit_ledger(user_id, amount, balance_after, kind, request_id, description)
  values (p_user_id, -computed_charge, next_balance, 'usage', p_request_id, 'Jela AI response');
  return jsonb_build_object(
    'charged', computed_charge,
    'usage_available', next_balance > 0,
    'next_free_reset_at', next_reset
  );
end;
$$;

create or replace function public.fail_jela_chat_request(
  p_user_id uuid,
  p_request_id uuid,
  p_error_code text,
  p_error_message text,
  p_partial_content text default '',
  p_duration_ms integer default 0
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare selected_usage public.jela_ai_usage;
begin
  select * into selected_usage from public.jela_ai_usage
  where request_id = p_request_id and user_id = p_user_id for update;
  if selected_usage.id is null or selected_usage.status <> 'processing' then return; end if;
  update public.jela_credit_wallets
  set reserved = reserved - selected_usage.credits_reserved, updated_at = now()
  where user_id = p_user_id;
  update public.jela_messages
  set content = left(coalesce(p_partial_content, ''), 200000), status = 'failed',
      error_code = left(coalesce(p_error_code, 'provider_error'), 100)
  where owner_id = p_user_id and request_id = p_request_id and role = 'assistant';
  update public.jela_ai_usage
  set status = 'failed', error_code = left(coalesce(p_error_code, 'provider_error'), 100),
      error_message = left(coalesce(p_error_message, 'The provider request failed.'), 1000),
      duration_ms = greatest(p_duration_ms, 0), completed_at = now()
  where id = selected_usage.id;
end;
$$;

create or replace function public.settle_jela_paystack_payment(
  p_reference text,
  p_provider_transaction_id text,
  p_provider_status text,
  p_amount_minor bigint,
  p_currency text,
  p_channel text,
  p_paid_at timestamptz,
  p_customer_email text,
  p_provider_subscription_id text default null,
  p_provider_customer_code text default null,
  p_provider_email_token text default null,
  p_receipt_number text default null,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  selected_attempt public.jela_payment_attempts;
  selected_version public.jela_plan_versions;
  selected_plan public.jela_plans;
  selected_email text;
  subscription_id uuid;
  normalized_status text;
  period_end timestamptz;
begin
  select * into selected_attempt from public.jela_payment_attempts
  where reference = p_reference for update;
  if selected_attempt.id is null then raise exception 'payment_attempt_not_found'; end if;
  if selected_attempt.fulfilled_at is not null then
    return jsonb_build_object('status', 'successful', 'fulfilled', true, 'idempotent', true);
  end if;

  select lower(email) into selected_email from auth.users where id = selected_attempt.user_id;
  normalized_status := case
    when p_provider_status = 'success' then 'successful'
    when p_provider_status in ('ongoing','pending','processing','queued') then 'processing'
    when p_provider_status = 'abandoned' then 'cancelled'
    when p_provider_status = 'reversed' then 'reversed'
    else 'failed' end;

  if p_amount_minor <> selected_attempt.amount_minor
    or upper(p_currency) <> selected_attempt.currency
    or selected_email is distinct from lower(p_customer_email)
  then
    update public.jela_payment_attempts
    set status = 'failed', provider_status = p_provider_status,
        failure_reason = 'provider_verification_mismatch', updated_at = now()
    where id = selected_attempt.id;
    insert into public.jela_security_events(subject_id, event_type, severity, metadata)
    values (selected_attempt.user_id, 'payment.verification_mismatch', 'critical',
      jsonb_build_object('reference', p_reference, 'amount', p_amount_minor, 'currency', p_currency));
    raise exception 'payment_verification_mismatch';
  end if;

  update public.jela_payment_attempts
  set status = normalized_status,
      provider_status = p_provider_status,
      provider_transaction_id = left(p_provider_transaction_id, 200),
      channel = left(p_channel, 60),
      paid_at = p_paid_at,
      metadata = metadata || jsonb_build_object('verification', p_provider_payload),
      updated_at = now()
  where id = selected_attempt.id;

  if normalized_status <> 'successful' then
    return jsonb_build_object('status', normalized_status, 'fulfilled', false, 'idempotent', false);
  end if;

  select * into selected_version from public.jela_plan_versions
  where id = selected_attempt.plan_version_id for update;
  select * into selected_plan from public.jela_plans where id = selected_attempt.plan_id;
  if selected_version.id is null or selected_version.internal_allowance is null
    or not selected_version.purchasable or not selected_version.active
  then raise exception 'plan_not_purchasable'; end if;

  update public.jela_subscriptions
  set status = 'cancelled', cancel_at_period_end = false, updated_at = now()
  where user_id = selected_attempt.user_id and status in ('trialing','active','past_due','grace_period');
  period_end := case selected_version.billing_interval
    when 'year' then now() + interval '1 year'
    when 'one_time' then null
    else now() + interval '1 month' end;

  insert into public.jela_subscriptions(
    user_id, plan_id, plan_version_id, provider, provider_subscription_id,
    provider_customer_code, provider_email_token, status,
    current_period_start, current_period_end
  ) values (
    selected_attempt.user_id, selected_plan.id, selected_version.id, 'paystack',
    coalesce(nullif(p_provider_subscription_id, ''), 'paystack:' || p_reference),
    nullif(p_provider_customer_code, ''), nullif(p_provider_email_token, ''),
    'active', now(), period_end
  ) returning id into subscription_id;

  insert into public.jela_billing_records(
    user_id, subscription_id, payment_attempt_id, provider, provider_record_id,
    provider_reference, amount_minor, currency, status, provider_status,
    description, channel, paid_at, receipt_number
  ) values (
    selected_attempt.user_id, subscription_id, selected_attempt.id, 'paystack',
    coalesce(nullif(p_provider_transaction_id, ''), p_reference), p_reference,
    selected_attempt.amount_minor, selected_attempt.currency, 'successful', p_provider_status,
    'Jela ' || selected_plan.name || ' subscription', left(p_channel, 60), p_paid_at, left(p_receipt_number, 200)
  ) on conflict (provider, provider_reference) where provider_reference is not null do nothing;

  update public.jela_credit_wallets
  set plan_version_id = selected_version.id,
      allowance = selected_version.internal_allowance,
      balance = selected_version.internal_allowance,
      reserved = 0,
      lifetime_granted = lifetime_granted + selected_version.internal_allowance,
      period_started_at = now(), period_ends_at = period_end,
      exhausted_at = null, next_free_reset_at = null, updated_at = now()
  where user_id = selected_attempt.user_id;

  update public.jela_payment_attempts
  set fulfilled_at = now(), updated_at = now() where id = selected_attempt.id;
  insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (selected_attempt.user_id, 'payment.fulfilled', 'payment', selected_attempt.id::text,
    jsonb_build_object('reference', p_reference, 'plan', selected_plan.code, 'subscription_id', subscription_id));
  return jsonb_build_object('status', 'successful', 'fulfilled', true, 'idempotent', false);
end;
$$;

create or replace function public.admin_update_jela_model_route(
  p_id uuid,
  p_model text,
  p_reasoning_effort text,
  p_max_output_tokens integer,
  p_tools jsonb,
  p_active_for_plans text[],
  p_enabled boolean,
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
  if char_length(trim(p_model)) < 2 or p_reasoning_effort not in ('none','low','medium','high','xhigh','max')
    or p_max_output_tokens not between 1 and 32768 or jsonb_typeof(p_tools) <> 'array'
    or char_length(trim(p_reason)) < 3 then raise exception 'invalid_model_configuration'; end if;
  select to_jsonb(m) into old_value from public.jela_model_config m where id = p_id;
  update public.jela_model_config
  set model = trim(p_model), reasoning_effort = p_reasoning_effort,
      max_output_tokens = p_max_output_tokens, tools = p_tools,
      active_for_plans = p_active_for_plans, enabled = p_enabled, updated_at = now()
  where id = p_id;
  if not found then raise exception 'model_route_not_found'; end if;
  insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'model_route.updated', 'model_config', p_id::text,
    jsonb_build_object('old', old_value, 'new_model', p_model, 'reason', trim(p_reason)));
end;
$$;

create or replace function public.admin_set_jela_trial_config(
  p_enabled boolean,
  p_plan_version_id uuid,
  p_duration_days integer,
  p_internal_allowance bigint,
  p_eligibility jsonb,
  p_repeat_allowed boolean,
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
  if p_duration_days not between 1 and 90 or jsonb_typeof(p_eligibility) <> 'object'
    or (p_enabled and (p_plan_version_id is null or p_internal_allowance is null or p_internal_allowance <= 0))
    or char_length(trim(p_reason)) < 3 then raise exception 'invalid_trial_configuration'; end if;
  select to_jsonb(t) into old_value from public.jela_trial_config t where id;
  insert into public.jela_trial_config(id, enabled, plan_version_id, duration_days, internal_allowance, eligibility, repeat_allowed, updated_by, updated_at)
  values (true, p_enabled, p_plan_version_id, p_duration_days, p_internal_allowance, p_eligibility, p_repeat_allowed, auth.uid(), now())
  on conflict (id) do update set enabled = excluded.enabled, plan_version_id = excluded.plan_version_id,
    duration_days = excluded.duration_days, internal_allowance = excluded.internal_allowance,
    eligibility = excluded.eligibility, repeat_allowed = excluded.repeat_allowed,
    updated_by = auth.uid(), updated_at = now();
  insert into public.jela_app_config(key, value, description)
  values ('trials_enabled', to_jsonb(p_enabled), 'Trials are controlled by Admin.')
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.jela_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'trials.configuration_updated', 'trial_config', 'global',
    jsonb_build_object('old', old_value, 'enabled', p_enabled, 'reason', trim(p_reason)));
end;
$$;

revoke all on function public.begin_jela_chat_request(uuid, uuid, uuid, text, text, uuid[]) from public;
revoke all on function public.complete_jela_chat_request(uuid, uuid, text, integer, integer, integer, text, jsonb, integer, integer, integer, integer) from public;
revoke all on function public.fail_jela_chat_request(uuid, uuid, text, text, text, integer) from public;
revoke all on function public.settle_jela_paystack_payment(text, text, text, bigint, text, text, timestamptz, text, text, text, text, text, jsonb) from public;
revoke all on function public.admin_update_jela_model_route(uuid, text, text, integer, jsonb, text[], boolean, text) from public;
revoke all on function public.admin_set_jela_trial_config(boolean, uuid, integer, bigint, jsonb, boolean, text) from public;
grant execute on function public.begin_jela_chat_request(uuid, uuid, uuid, text, text, uuid[]) to service_role;
grant execute on function public.complete_jela_chat_request(uuid, uuid, text, integer, integer, integer, text, jsonb, integer, integer, integer, integer) to service_role;
grant execute on function public.fail_jela_chat_request(uuid, uuid, text, text, text, integer) to service_role;
grant execute on function public.settle_jela_paystack_payment(text, text, text, bigint, text, text, timestamptz, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.admin_update_jela_model_route(uuid, text, text, integer, jsonb, text[], boolean, text) to authenticated;
grant execute on function public.admin_set_jela_trial_config(boolean, uuid, integer, bigint, jsonb, boolean, text) to authenticated;

comment on function public.begin_jela_chat_request(uuid, uuid, uuid, text, text, uuid[]) is
  'Atomic plan, override, mode, tool, attachment, idempotency, and hidden-usage reservation gate.';
comment on function public.settle_jela_paystack_payment(text, text, text, bigint, text, text, timestamptz, text, text, text, text, text, jsonb) is
  'Idempotent server-only Paystack settlement. Verified provider amount, currency, email, and reference are required before entitlement activation.';
