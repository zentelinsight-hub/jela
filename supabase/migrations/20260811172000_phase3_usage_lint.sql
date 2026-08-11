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
