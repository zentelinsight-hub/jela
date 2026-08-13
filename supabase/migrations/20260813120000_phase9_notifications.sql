-- Phase 9 native notification registration, durable inbox, broadcast audit, and delivery tracking.

alter table public.jela_push_tokens
  add column if not exists expo_push_token text,
  add column if not exists installation_id text,
  add column if not exists device_name text,
  add column if not exists app_version text,
  add column if not exists permission_status text not null default 'undetermined',
  add column if not exists app_state text not null default 'unknown',
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists disabled_reason text;

alter table public.jela_push_tokens drop constraint if exists jela_push_tokens_permission_status_check;
alter table public.jela_push_tokens add constraint jela_push_tokens_permission_status_check
  check (permission_status in ('granted', 'denied', 'undetermined'));
alter table public.jela_push_tokens drop constraint if exists jela_push_tokens_app_state_check;
alter table public.jela_push_tokens add constraint jela_push_tokens_app_state_check
  check (app_state in ('active', 'background', 'inactive', 'unknown'));
create unique index if not exists jela_push_tokens_user_installation_unique
  on public.jela_push_tokens(user_id, installation_id);
create index if not exists jela_push_tokens_delivery_idx
  on public.jela_push_tokens(enabled, permission_status, last_seen_at desc);

create table if not exists public.jela_notifications (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references public.jela_accounts(id) on delete cascade,
  audience text not null default 'all' check (audience in ('all', 'user')),
  kind text not null default 'admin_broadcast' check (kind in ('admin_broadcast', 'chat_complete', 'security', 'system')),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 280),
  data jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'partial', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint jela_notifications_target_check check (
    (audience = 'all' and target_user_id is null) or
    (audience = 'user' and target_user_id is not null)
  )
);
create index if not exists jela_notifications_inbox_idx
  on public.jela_notifications(audience, target_user_id, created_at desc);

create table if not exists public.jela_notification_reads (
  notification_id uuid not null references public.jela_notifications(id) on delete cascade,
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists public.jela_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.jela_notifications(id) on delete cascade,
  token_id uuid not null references public.jela_push_tokens(id) on delete cascade,
  user_id uuid not null references public.jela_accounts(id) on delete cascade,
  ticket_id text,
  status text not null default 'queued' check (status in ('queued', 'accepted', 'delivered', 'failed')),
  error_code text,
  error_message text,
  receipt_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id, token_id)
);
create index if not exists jela_notification_deliveries_receipt_idx
  on public.jela_notification_deliveries(status, receipt_checked_at, created_at);

alter table public.jela_notifications enable row level security;
alter table public.jela_notification_reads enable row level security;
alter table public.jela_notification_deliveries enable row level security;

-- Push tokens and provider tickets are server-only. Mobile clients use verified Edge functions.
drop policy if exists "Users manage their own push tokens" on public.jela_push_tokens;
revoke all on public.jela_push_tokens, public.jela_notifications,
  public.jela_notification_reads, public.jela_notification_deliveries from anon, authenticated;
grant all on public.jela_push_tokens, public.jela_notifications,
  public.jela_notification_reads, public.jela_notification_deliveries to service_role;

insert into public.jela_app_config(key, value, description)
values ('push_notifications_enabled', 'true'::jsonb, 'Native push registration and the durable Jela AI notification inbox are enabled.')
on conflict (key) do update set value = excluded.value, description = excluded.description, updated_at = now();
