-- Notify only the affected account channel when authoritative usage changes.
create or replace function public.touch_jela_account_for_wallet()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.jela_accounts set updated_at = now() where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists touch_jela_account_for_wallet on public.jela_credit_wallets;
create trigger touch_jela_account_for_wallet
after update of balance, reserved, allowance, plan_version_id, next_free_reset_at
on public.jela_credit_wallets
for each row
when (
  old.balance is distinct from new.balance
  or old.reserved is distinct from new.reserved
  or old.allowance is distinct from new.allowance
  or old.plan_version_id is distinct from new.plan_version_id
  or old.next_free_reset_at is distinct from new.next_free_reset_at
)
execute function public.touch_jela_account_for_wallet();

revoke all on function public.touch_jela_account_for_wallet() from public;

comment on function public.touch_jela_account_for_wallet() is
  'Publishes an opaque owner-scoped account revision after authoritative usage changes; wallet values remain private.';
