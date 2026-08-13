-- Retire the email OTP second step. A valid Supabase Auth session remains
-- mandatory, while existing RLS policies retain their compatibility helper.
create or replace function public.is_jela_session_verified()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and public.jela_session_id() is not null;
$$;

comment on function public.is_jela_session_verified() is
  'Compatibility helper: true for a valid authenticated Jela session. Email OTP is no longer required.';

-- Cancel outstanding challenges so old codes cannot be completed after rollout.
update public.jela_login_challenges
set status = 'cancelled',
    updated_at = now()
where status = 'pending';
