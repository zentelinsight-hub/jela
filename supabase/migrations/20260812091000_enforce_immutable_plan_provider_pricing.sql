-- Plan prices are immutable once created. New prices require a new version and
-- one Paystack plan code may never represent two different amounts.

create or replace function public.enforce_jela_plan_version_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.price_minor <> old.price_minor then
    raise exception 'plan_version_price_is_immutable';
  end if;
  if new.provider_plan_code is not null and exists (
    select 1
    from public.jela_plan_versions existing
    where existing.provider_plan_code = new.provider_plan_code
      and existing.id <> new.id
      and existing.price_minor <> new.price_minor
  ) then
    raise exception 'provider_plan_price_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists jela_plan_version_immutability on public.jela_plan_versions;
create trigger jela_plan_version_immutability
before insert or update on public.jela_plan_versions
for each row execute function public.enforce_jela_plan_version_immutability();

revoke all on function public.enforce_jela_plan_version_immutability() from public, anon, authenticated;
