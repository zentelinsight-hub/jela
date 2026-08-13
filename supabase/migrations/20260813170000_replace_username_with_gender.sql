alter table public.jela_accounts
  add column if not exists gender text;

alter table public.jela_accounts drop constraint if exists jela_accounts_gender_check;
alter table public.jela_accounts add constraint jela_accounts_gender_check
  check (gender is null or gender in ('male', 'female', 'prefer_not_to_say'));

create or replace function public.is_jela_profile_complete(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.jela_accounts
    where id = check_user_id
      and char_length(btrim(first_name)) >= 2
      and char_length(btrim(last_name)) >= 2
      and age is not null
      and gender is not null
      and profile_completed_at is not null
      and (not google_identity or password_set_at is not null)
  );
$$;

create or replace function public.update_jela_profile_v3(
  p_first_name text,
  p_last_name text,
  p_age integer,
  p_gender text
)
returns public.jela_accounts
language plpgsql security definer set search_path = public, pg_temp as $$
declare updated_account public.jela_accounts;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if char_length(btrim(coalesce(p_first_name, ''))) not between 2 and 60
    or char_length(btrim(coalesce(p_last_name, ''))) not between 2 and 60
    or p_age not between 13 and 120
    or p_gender not in ('male', 'female', 'prefer_not_to_say')
  then raise exception 'invalid_profile'; end if;

  update public.jela_accounts
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      display_name = concat_ws(' ', btrim(p_first_name), btrim(p_last_name)),
      gender = p_gender,
      age = p_age,
      profile_completed_at = now(),
      updated_at = now()
  where id = auth.uid()
  returning * into updated_account;
  return updated_account;
end;
$$;

revoke all on function public.update_jela_profile_v3(text, text, integer, text) from public;
grant execute on function public.update_jela_profile_v3(text, text, integer, text) to authenticated;
