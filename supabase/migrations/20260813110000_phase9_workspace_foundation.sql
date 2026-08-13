-- Phase 9: persistent personal workspace, scoped memory, projects, files, entitlements and jobs.
-- Additive only: no production identities or existing workspace records are removed.

create extension if not exists vector with schema extensions;

do $$ begin
  create type public.jela_memory_scope as enum ('global', 'project', 'conversation');
exception when duplicate_object then null; end $$;

create table if not exists public.jela_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 1000),
  instructions text check (instructions is null or char_length(instructions) <= 8000),
  icon text,
  cover_path text,
  archived_at timestamptz,
  deleted_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jela_projects_owner_activity_idx
  on public.jela_projects(owner_id, archived_at, last_activity_at desc) where deleted_at is null;
create index if not exists jela_projects_name_search_idx
  on public.jela_projects using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));

alter table public.jela_conversations
  add column if not exists project_id uuid references public.jela_projects(id) on delete set null;
alter table public.jela_generated_images
  add column if not exists project_id uuid references public.jela_projects(id) on delete set null;
create index if not exists jela_conversations_project_updated_idx
  on public.jela_conversations(project_id, updated_at desc) where archived_at is null;
create index if not exists jela_generated_images_project_created_idx
  on public.jela_generated_images(project_id, created_at desc) where status='ready';

create table if not exists public.jela_conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.jela_conversations(id) on delete cascade,
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  summary text not null check (char_length(summary) between 1 and 20000),
  source_message_from uuid references public.jela_messages(id) on delete set null,
  source_message_to uuid references public.jela_messages(id) on delete set null,
  source_message_count integer not null default 0 check (source_message_count >= 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, version)
);
create index if not exists jela_conversation_summaries_latest_idx
  on public.jela_conversation_summaries(conversation_id, version desc);

create table if not exists public.jela_memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  scope public.jela_memory_scope not null,
  project_id uuid references public.jela_projects(id) on delete cascade,
  conversation_id uuid references public.jela_conversations(id) on delete cascade,
  category text not null default 'other' check (category in ('about_you','preferences','work_business','learning','project','other')),
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  normalized_content text not null check (char_length(normalized_content) between 1 and 4000),
  content_hash text not null,
  importance smallint not null default 5 check (importance between 1 and 10),
  pinned boolean not null default false,
  source_type text not null default 'manual' check (source_type in ('manual','conversation','project','imported')),
  source_message_id uuid references public.jela_messages(id) on delete set null,
  supersedes_id uuid references public.jela_memories(id) on delete set null,
  embedding extensions.vector(1536),
  embedding_model text,
  embedding_version integer not null default 1,
  embedding_status text not null default 'pending' check (embedding_status in ('pending','ready','failed','stale')),
  last_used_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jela_memories_scope_shape check (
    (scope = 'global' and project_id is null and conversation_id is null)
    or (scope = 'project' and project_id is not null and conversation_id is null)
    or (scope = 'conversation' and conversation_id is not null)
  )
);
create unique index if not exists jela_memories_owner_scope_hash_unique
  on public.jela_memories(owner_id, scope, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(conversation_id, '00000000-0000-0000-0000-000000000000'::uuid), content_hash)
  where deleted_at is null;
create index if not exists jela_memories_owner_scope_updated_idx
  on public.jela_memories(owner_id, scope, updated_at desc) where deleted_at is null;
create index if not exists jela_memories_project_idx
  on public.jela_memories(project_id, updated_at desc) where deleted_at is null;
create index if not exists jela_memories_search_idx
  on public.jela_memories using gin (to_tsvector('simple', normalized_content)) where deleted_at is null;
create index if not exists jela_memories_embedding_hnsw_idx
  on public.jela_memories using hnsw (embedding extensions.vector_cosine_ops)
  where deleted_at is null and embedding_status = 'ready';

create table if not exists public.jela_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  project_id uuid references public.jela_projects(id) on delete cascade,
  conversation_id uuid references public.jela_conversations(id) on delete set null,
  original_name text not null check (char_length(original_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','text/plain','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  content_hash text,
  status text not null default 'uploading' check (status in ('uploading','processing','ready','unable_to_process','deleted')),
  extraction_error text,
  reserved_meter_id uuid,
  reserved_bytes bigint not null default 0 check (reserved_bytes >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jela_files_path_owner check (split_part(storage_path, '/', 1) = owner_id::text)
);
create index if not exists jela_files_owner_updated_idx
  on public.jela_files(owner_id, updated_at desc) where deleted_at is null;
create index if not exists jela_files_project_updated_idx
  on public.jela_files(project_id, updated_at desc) where deleted_at is null;
create index if not exists jela_files_name_search_idx
  on public.jela_files using gin (to_tsvector('simple', original_name)) where deleted_at is null;

create table if not exists public.jela_document_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.jela_files(id) on delete cascade,
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  project_id uuid references public.jela_projects(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) between 1 and 20000),
  token_estimate integer not null default 0 check (token_estimate >= 0),
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  embedding_model text,
  embedding_version integer not null default 1,
  embedding_status text not null default 'pending' check (embedding_status in ('pending','ready','failed','stale')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (file_id, chunk_index)
);
create index if not exists jela_document_chunks_owner_file_idx on public.jela_document_chunks(owner_id, file_id, chunk_index);
create index if not exists jela_document_chunks_search_idx on public.jela_document_chunks using gin (to_tsvector('simple', content));
create index if not exists jela_document_chunks_embedding_hnsw_idx
  on public.jela_document_chunks using hnsw (embedding extensions.vector_cosine_ops) where embedding_status = 'ready';

create table if not exists public.jela_workspace_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.jela_accounts(id) on delete cascade,
  job_type text not null check (job_type in ('memory_embed','memory_extract','conversation_summarize','file_extract','file_embed','file_delete','project_delete')),
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  priority smallint not null default 5 check (priority between 1 and 10),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jela_workspace_jobs_claim_idx on public.jela_workspace_jobs(status, run_after, priority, created_at);
create unique index if not exists jela_workspace_jobs_active_entity_unique
  on public.jela_workspace_jobs(job_type, entity_id) where status in ('queued','processing') and entity_id is not null;

create table if not exists public.jela_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  installation_id text not null,
  platform text not null check (platform in ('android','windows','web','ios','macos')),
  device_name text not null,
  app_version text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, installation_id)
);
create index if not exists jela_devices_owner_seen_idx on public.jela_devices(owner_id, last_seen_at desc);

create table if not exists public.jela_usage_meters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  meter_key text not null check (meter_key in ('web_search','image_generation','memory_items','storage_bytes','projects','file_analysis')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  used bigint not null default 0 check (used >= 0),
  reserved bigint not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now(),
  unique (owner_id, meter_key, period_start)
);
create index if not exists jela_usage_meters_owner_period_idx on public.jela_usage_meters(owner_id, period_end desc);

create table if not exists public.jela_workspace_retrieval_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.jela_accounts(id) on delete cascade,
  conversation_id uuid references public.jela_conversations(id) on delete cascade,
  project_id uuid references public.jela_projects(id) on delete set null,
  request_id uuid,
  memory_ids uuid[] not null default array[]::uuid[],
  file_chunk_ids uuid[] not null default array[]::uuid[],
  recent_message_count integer not null default 0,
  summary_included boolean not null default false,
  context_chars integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists jela_workspace_retrieval_events_owner_created_idx
  on public.jela_workspace_retrieval_events(owner_id,created_at desc);

do $$ begin
  alter table public.jela_files add constraint jela_files_reserved_meter_fk
    foreign key (reserved_meter_id) references public.jela_usage_meters(id) on delete set null;
exception when duplicate_object then null; end $$;

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
begin
  if p_user_id is null then raise exception 'authentication_required'; end if;
  if p_user_id <> auth.uid() and not public.is_jela_admin(auth.uid()) and coalesce(auth.jwt() ->> 'role','') <> 'service_role' then
    raise exception 'access_denied';
  end if;
  select version.* into version_row
  from public.jela_credit_wallets wallet
  join public.jela_plan_versions version on version.id = wallet.plan_version_id
  where wallet.user_id = p_user_id;
  if version_row.id is not null then
    select plan.code into plan_code from public.jela_plans plan where plan.id = version_row.plan_id;
    features := coalesce(version_row.feature_config, '{}'::jsonb);
    limits := coalesce(version_row.rate_limits, '{}'::jsonb);
  end if;
  select * into account_override from public.jela_user_ai_overrides where user_id = p_user_id;
  if account_override.user_id is not null and not account_override.use_plan_defaults then
    features := features || coalesce(account_override.override_config -> 'features', account_override.override_config);
    limits := limits || coalesce(account_override.override_config -> 'limits', '{}'::jsonb);
  end if;
  -- Global flags are authoritative kill switches and cannot be overridden by a plan.
  features := features || jsonb_build_object(
    'chat_enabled', coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key='chat_enabled'), false),
    'memory_enabled', coalesce((features ->> 'memory_enabled')::boolean, true)
      and coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key='memory_enabled'), false),
    'projects_enabled', coalesce((features ->> 'projects_enabled')::boolean, true)
      and coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key='projects_enabled'), false),
    'workspace_files_enabled', coalesce((features ->> 'workspace_files_enabled')::boolean, true)
      and coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key='workspace_files_enabled'), false),
    'image_generation_enabled', coalesce((features ->> 'image_generation_enabled')::boolean, true)
      and coalesce((select (value #>> '{}')::boolean from public.jela_app_config where key='image_generation_enabled'), false)
  );
  limits := jsonb_build_object(
    'memory_item_limit', case plan_code when 'pro' then 1000 when 'plus' then 300 when 'starter' then 100 else 30 end,
    'storage_bytes_limit', case plan_code when 'pro' then 10737418240 when 'plus' then 2147483648 when 'starter' then 536870912 else 104857600 end,
    'max_projects', case plan_code when 'pro' then 100 when 'plus' then 30 when 'starter' then 10 else 3 end,
    'image_generation_limit', case plan_code when 'pro' then 500 when 'plus' then 150 when 'starter' then 50 else 8 end,
    'web_search_limit', case plan_code when 'pro' then 1000 when 'plus' then 300 when 'starter' then 100 else 10 end,
    'max_file_size', case plan_code when 'pro' then 52428800 when 'plus' then 26214400 else 10485760 end,
    'max_project_files', case plan_code when 'pro' then 500 when 'plus' then 150 when 'starter' then 50 else 10 end
  ) || limits;
  return jsonb_build_object('plan_code', plan_code, 'features', features, 'limits', limits);
end;
$$;

create or replace function public.reserve_jela_meter(
  p_user_id uuid,
  p_meter_key text,
  p_amount bigint,
  p_limit bigint,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare meter public.jela_usage_meters;
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_amount <= 0 or p_limit < 0 or p_period_end <= p_period_start then raise exception 'invalid_meter_request'; end if;
  insert into public.jela_usage_meters(owner_id, meter_key, period_start, period_end)
  values (p_user_id, p_meter_key, p_period_start, p_period_end)
  on conflict (owner_id, meter_key, period_start) do nothing;
  select * into meter from public.jela_usage_meters
  where owner_id=p_user_id and meter_key=p_meter_key and period_start=p_period_start for update;
  if meter.used + meter.reserved + p_amount > p_limit then
    return jsonb_build_object('allowed', false, 'used', meter.used, 'reserved', meter.reserved, 'limit', p_limit);
  end if;
  update public.jela_usage_meters set reserved=reserved+p_amount, updated_at=now() where id=meter.id returning * into meter;
  return jsonb_build_object('allowed', true, 'meter_id', meter.id, 'used', meter.used, 'reserved', meter.reserved, 'limit', p_limit);
end;
$$;

create or replace function public.settle_jela_meter(p_meter_id uuid, p_reserved bigint, p_used bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_reserved < 0 or p_used < 0 then raise exception 'invalid_meter_settlement'; end if;
  update public.jela_usage_meters
  set reserved=greatest(0,reserved-p_reserved), used=used+p_used, updated_at=now()
  where id=p_meter_id and reserved >= p_reserved;
  if not found then raise exception 'meter_not_found'; end if;
end;
$$;

create or replace function public.adjust_jela_meter(p_meter_id uuid, p_used_delta bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then raise exception 'service_role_required'; end if;
  update public.jela_usage_meters
  set used=greatest(0,used+p_used_delta), updated_at=now()
  where id=p_meter_id;
  if not found then raise exception 'meter_not_found'; end if;
end;
$$;

create or replace function public.claim_jela_workspace_job(p_worker text)
returns public.jela_workspace_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare claimed public.jela_workspace_jobs;
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then raise exception 'service_role_required'; end if;
  select * into claimed from public.jela_workspace_jobs
  where status='queued' and run_after<=now() and attempts<max_attempts
  order by priority asc, created_at asc for update skip locked limit 1;
  if claimed.id is null then return null; end if;
  update public.jela_workspace_jobs set status='processing',locked_at=now(),locked_by=p_worker,attempts=attempts+1
  where id=claimed.id returning * into claimed;
  return claimed;
end;
$$;

create or replace function public.create_jela_project(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_instructions text,
  p_limit integer
)
returns public.jela_projects
language plpgsql security definer set search_path = public, pg_temp as $$
declare created public.jela_projects;
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then raise exception 'service_role_required'; end if;
  if char_length(btrim(coalesce(p_name,''))) not between 1 and 100 then raise exception 'invalid_project_name'; end if;
  perform pg_advisory_xact_lock(hashtextextended('jela-project:' || p_user_id::text, 0));
  if (select count(*) from public.jela_projects where owner_id=p_user_id and deleted_at is null) >= p_limit then
    raise exception 'project_limit_reached';
  end if;
  insert into public.jela_projects(owner_id,name,description,instructions)
  values(p_user_id,btrim(p_name),nullif(btrim(p_description),''),nullif(btrim(p_instructions),'')) returning * into created;
  return created;
end;
$$;

create or replace function public.create_jela_memory(
  p_user_id uuid,
  p_scope public.jela_memory_scope,
  p_project_id uuid,
  p_conversation_id uuid,
  p_category text,
  p_content text,
  p_content_hash text,
  p_importance smallint,
  p_source_type text,
  p_source_message_id uuid,
  p_limit integer
)
returns public.jela_memories
language plpgsql security definer set search_path = public, pg_temp as $$
declare created public.jela_memories;
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then raise exception 'service_role_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('jela-memory:' || p_user_id::text, 0));
  if (select count(*) from public.jela_memories where owner_id=p_user_id and deleted_at is null) >= p_limit then
    raise exception 'memory_limit_reached';
  end if;
  if p_project_id is not null and not exists(select 1 from public.jela_projects where id=p_project_id and owner_id=p_user_id and deleted_at is null) then
    raise exception 'project_not_found';
  end if;
  if p_conversation_id is not null and not exists(select 1 from public.jela_conversations where id=p_conversation_id and owner_id=p_user_id) then
    raise exception 'conversation_not_found';
  end if;
  insert into public.jela_memories(owner_id,scope,project_id,conversation_id,category,content,normalized_content,
    content_hash,importance,source_type,source_message_id)
  values(p_user_id,p_scope,p_project_id,p_conversation_id,p_category,btrim(p_content),lower(regexp_replace(btrim(p_content),'\\s+',' ','g')),
    p_content_hash,p_importance,p_source_type,p_source_message_id)
  on conflict do nothing returning * into created;
  if created.id is null then
    select * into created from public.jela_memories
    where owner_id=p_user_id and scope=p_scope
      and coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_project_id,'00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(conversation_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_conversation_id,'00000000-0000-0000-0000-000000000000'::uuid)
      and content_hash=p_content_hash and deleted_at is null;
  end if;
  return created;
end;
$$;

create or replace function public.search_jela_memories(
  p_user_id uuid,
  p_query text,
  p_embedding extensions.vector(1536),
  p_project_id uuid default null,
  p_conversation_id uuid default null,
  p_limit integer default 8
)
returns table(id uuid, scope public.jela_memory_scope, content text, category text, pinned boolean, rank real)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select memory.id, memory.scope, memory.content, memory.category, memory.pinned,
    (
      (case when p_embedding is not null and memory.embedding is not null then (1 - (memory.embedding <=> p_embedding)) * 0.62 else 0 end)
      + ts_rank_cd(to_tsvector('simple', memory.normalized_content), plainto_tsquery('simple', p_query)) * 0.23
      + case when memory.pinned then 0.10 else 0 end
      + memory.importance::real / 200.0
    )::real as rank
  from public.jela_memories memory
  where memory.owner_id = p_user_id
    and (p_user_id = auth.uid() or coalesce(auth.jwt() ->> 'role','')='service_role')
    and (coalesce(auth.jwt() ->> 'role','')='service_role' or public.is_jela_session_verified())
    and memory.deleted_at is null
    and (
      memory.scope = 'global'
      or (memory.scope='project' and p_project_id is not null and memory.project_id=p_project_id)
      or (memory.scope='conversation' and p_conversation_id is not null and memory.conversation_id=p_conversation_id)
    )
    and (memory.embedding_status='ready' or to_tsvector('simple', memory.normalized_content) @@ plainto_tsquery('simple', p_query))
  order by rank desc, memory.updated_at desc
  limit least(greatest(p_limit,1),20);
$$;

create or replace function public.search_jela_document_chunks(
  p_user_id uuid,
  p_query text,
  p_embedding extensions.vector(1536),
  p_project_id uuid default null,
  p_file_ids uuid[] default null,
  p_limit integer default 8
)
returns table(id uuid, file_id uuid, content text, metadata jsonb, rank real)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select chunk.id, chunk.file_id, chunk.content, chunk.metadata,
    ((case when p_embedding is not null and chunk.embedding is not null then (1-(chunk.embedding <=> p_embedding))*0.72 else 0 end)
      + ts_rank_cd(to_tsvector('simple',chunk.content),plainto_tsquery('simple',p_query))*0.28)::real as rank
  from public.jela_document_chunks chunk
  join public.jela_files file on file.id=chunk.file_id and file.deleted_at is null and file.status='ready'
  where chunk.owner_id=p_user_id
    and (p_user_id=auth.uid() or coalesce(auth.jwt() ->> 'role','')='service_role')
    and (coalesce(auth.jwt() ->> 'role','')='service_role' or public.is_jela_session_verified())
    and (
      (p_project_id is null and chunk.project_id is null)
      or (p_project_id is not null and (chunk.project_id is null or chunk.project_id=p_project_id))
    )
    and (p_file_ids is null or chunk.file_id=any(p_file_ids))
    and (chunk.embedding_status='ready' or to_tsvector('simple',chunk.content) @@ plainto_tsquery('simple',p_query))
  order by rank desc limit least(greatest(p_limit,1),20);
$$;

alter table public.jela_projects enable row level security;
alter table public.jela_conversation_summaries enable row level security;
alter table public.jela_memories enable row level security;
alter table public.jela_files enable row level security;
alter table public.jela_document_chunks enable row level security;
alter table public.jela_workspace_jobs enable row level security;
alter table public.jela_devices enable row level security;
alter table public.jela_usage_meters enable row level security;
alter table public.jela_workspace_retrieval_events enable row level security;

grant select on public.jela_projects, public.jela_memories, public.jela_files to authenticated;
grant select,insert,update,delete on public.jela_devices to authenticated;
grant select on public.jela_conversation_summaries, public.jela_usage_meters to authenticated;
grant all on public.jela_projects, public.jela_conversation_summaries, public.jela_memories, public.jela_files,
  public.jela_document_chunks, public.jela_workspace_jobs, public.jela_devices, public.jela_usage_meters to service_role;
grant all on public.jela_workspace_retrieval_events to service_role;

create policy "Users read their own projects" on public.jela_projects for select to authenticated
using (owner_id=auth.uid() and public.is_jela_session_verified());
create policy "Users read their conversation summaries" on public.jela_conversation_summaries for select to authenticated
using (owner_id=auth.uid() and public.is_jela_session_verified());
create policy "Users read their own memories" on public.jela_memories for select to authenticated
using (owner_id=auth.uid() and public.is_jela_session_verified());
create policy "Users read their own file records" on public.jela_files for select to authenticated
using (owner_id=auth.uid() and public.is_jela_session_verified());
create policy "Users read their own usage meters" on public.jela_usage_meters for select to authenticated
using (owner_id=auth.uid() and public.is_jela_session_verified());
create policy "Users manage their device records" on public.jela_devices for all to authenticated
using (owner_id=auth.uid() and public.is_jela_session_verified()) with check (owner_id=auth.uid() and public.is_jela_session_verified());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('jela-workspace-files','jela-workspace-files',false,52428800,array['application/pdf','text/plain','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Users read their private workspace files" on storage.objects for select to authenticated
using (bucket_id='jela-workspace-files' and split_part(name,'/',1)=auth.uid()::text and public.is_jela_session_verified()
  and exists(select 1 from public.jela_files file where file.storage_path=name and file.owner_id=auth.uid() and file.deleted_at is null));

revoke all on function public.resolve_jela_entitlements(uuid) from public;
revoke all on function public.reserve_jela_meter(uuid,text,bigint,bigint,timestamptz,timestamptz) from public;
revoke all on function public.settle_jela_meter(uuid,bigint,bigint) from public;
revoke all on function public.adjust_jela_meter(uuid,bigint) from public;
revoke all on function public.claim_jela_workspace_job(text) from public;
revoke all on function public.create_jela_project(uuid,text,text,text,integer) from public;
revoke all on function public.create_jela_memory(uuid,public.jela_memory_scope,uuid,uuid,text,text,text,smallint,text,uuid,integer) from public;
revoke all on function public.search_jela_memories(uuid,text,extensions.vector,uuid,uuid,integer) from public;
revoke all on function public.search_jela_document_chunks(uuid,text,extensions.vector,uuid,uuid[],integer) from public;
grant execute on function public.resolve_jela_entitlements(uuid) to authenticated,service_role;
grant execute on function public.reserve_jela_meter(uuid,text,bigint,bigint,timestamptz,timestamptz) to service_role;
grant execute on function public.settle_jela_meter(uuid,bigint,bigint) to service_role;
grant execute on function public.adjust_jela_meter(uuid,bigint) to service_role;
grant execute on function public.claim_jela_workspace_job(text) to service_role;
grant execute on function public.create_jela_project(uuid,text,text,text,integer) to service_role;
grant execute on function public.create_jela_memory(uuid,public.jela_memory_scope,uuid,uuid,text,text,text,smallint,text,uuid,integer) to service_role;
grant execute on function public.search_jela_memories(uuid,text,extensions.vector,uuid,uuid,integer) to authenticated,service_role;
grant execute on function public.search_jela_document_chunks(uuid,text,extensions.vector,uuid,uuid[],integer) to authenticated,service_role;

insert into public.jela_app_config(key,value,description) values
  ('projects_enabled','false'::jsonb,'Controlled rollout for persistent Projects.'),
  ('workspace_files_enabled','false'::jsonb,'Controlled rollout for first-class workspace Files.'),
  ('memory_auto_save_enabled','false'::jsonb,'Server-side automatic useful-memory extraction rollout.'),
  ('memory_reference_enabled','true'::jsonb,'Existing memories may be referenced when Memory is enabled.'),
  ('embedding_model','"text-embedding-3-small"'::jsonb,'Server-side workspace embedding model.'),
  ('embedding_dimensions','1536'::jsonb,'Vector dimension used by workspace retrieval.'),
  ('workspace_text_max_bytes','1048576'::jsonb,'Maximum text-file size currently supported by the complete extraction and embedding pipeline.'),
  ('workspace_context_budget','{"recent_messages":14,"summary_chars":6000,"memory_items":8,"memory_chars":6000,"file_chunks":8,"file_chars":12000}'::jsonb,'Context selection limits used by the server orchestrator.')
on conflict(key) do update set description=excluded.description;

update public.jela_plan_versions version set
  feature_config = version.feature_config || case (select code from public.jela_plans where id=version.plan_id)
    when 'free' then '{"memory_enabled":true,"auto_memory_enabled":false,"projects_enabled":true,"workspace_files_enabled":true,"file_analysis_enabled":true}'::jsonb
    else '{"memory_enabled":true,"auto_memory_enabled":true,"projects_enabled":true,"workspace_files_enabled":true,"file_analysis_enabled":true}'::jsonb end,
  rate_limits = version.rate_limits || case (select code from public.jela_plans where id=version.plan_id)
    when 'pro' then '{"memory_item_limit":1000,"storage_bytes_limit":10737418240,"max_projects":100,"image_generation_limit":500,"web_search_limit":1000,"max_file_size":52428800,"max_project_files":500}'::jsonb
    when 'plus' then '{"memory_item_limit":300,"storage_bytes_limit":2147483648,"max_projects":30,"image_generation_limit":150,"web_search_limit":300,"max_file_size":26214400,"max_project_files":150}'::jsonb
    when 'starter' then '{"memory_item_limit":100,"storage_bytes_limit":536870912,"max_projects":10,"image_generation_limit":50,"web_search_limit":100,"max_file_size":10485760,"max_project_files":50}'::jsonb
    else '{"memory_item_limit":30,"storage_bytes_limit":104857600,"max_projects":3,"image_generation_limit":8,"web_search_limit":10,"max_file_size":10485760,"max_project_files":10}'::jsonb end,
  updated_at=now()
where version.active;

create trigger set_jela_projects_updated_at before update on public.jela_projects for each row execute function public.set_jela_updated_at();
create trigger set_jela_conversation_summaries_updated_at before update on public.jela_conversation_summaries for each row execute function public.set_jela_updated_at();
create trigger set_jela_memories_updated_at before update on public.jela_memories for each row execute function public.set_jela_updated_at();
create trigger set_jela_files_updated_at before update on public.jela_files for each row execute function public.set_jela_updated_at();
create trigger set_jela_document_chunks_updated_at before update on public.jela_document_chunks for each row execute function public.set_jela_updated_at();
create trigger set_jela_workspace_jobs_updated_at before update on public.jela_workspace_jobs for each row execute function public.set_jela_updated_at();

do $$ begin alter publication supabase_realtime add table public.jela_projects; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.jela_memories; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.jela_files; exception when duplicate_object then null; end $$;
