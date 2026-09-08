-- Qwen Polymarket Observatory v1
--
-- The browser can observe qwen_state and public qwen_events. Owner messages
-- remain authenticated and the MSI bridge talks to the RPCs with a separate
-- hash-only device token. Polymarket credentials never enter this schema.

create extension if not exists pgcrypto;

create table if not exists public.qwen_instances (
  id text primary key,
  pam_instance_id uuid not null references public.pam_instances(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  model text not null,
  session_key text not null,
  objective_file text not null default 'OBJECTIVE.md',
  status text not null default 'offline'
    check (status in ('offline', 'starting', 'online', 'degraded', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qwen_state (
  qwen_id text primary key references public.qwen_instances(id) on delete cascade,
  display_name text not null default 'Qwen / Polymarket US',
  agent_id text not null,
  model text not null,
  objective_label text not null default 'Local-model Polymarket US experiment',
  status text not null default 'offline'
    check (status in ('offline', 'starting', 'online', 'degraded', 'error')),
  components_json jsonb not null default '{}'::jsonb,
  account_json jsonb not null default '{}'::jsonb,
  portfolio_json jsonb not null default '{}'::jsonb,
  activity_json jsonb not null default '{}'::jsonb,
  objective_json jsonb not null default '{}'::jsonb,
  error_json jsonb not null default '{}'::jsonb,
  retry_json jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.qwen_messages (
  id uuid primary key default gen_random_uuid(),
  qwen_id text not null references public.qwen_instances(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null,
  sender_type text not null check (sender_type in ('user', 'qwen', 'system')),
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  provenance_tag text not null default 'Observed'
    check (provenance_tag in ('Observed', 'Inferred', 'Assumed', 'Unknown')),
  response_to_id uuid references public.qwen_messages(id) on delete set null,
  error_text text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.qwen_events (
  id bigint generated always as identity primary key,
  qwen_id text not null references public.qwen_instances(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.qwen_messages(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public', 'owner')),
  event_type text not null,
  status text not null default 'info'
    check (status in ('info', 'queued', 'running', 'succeeded', 'failed')),
  summary text not null default '',
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists qwen_messages_queue_idx
  on public.qwen_messages(qwen_id, status, created_at);
create index if not exists qwen_messages_owner_idx
  on public.qwen_messages(owner_user_id, qwen_id, created_at);
create index if not exists qwen_events_public_idx
  on public.qwen_events(qwen_id, visibility, created_at desc);
create index if not exists qwen_events_owner_idx
  on public.qwen_events(owner_user_id, qwen_id, created_at desc);

alter table public.qwen_instances enable row level security;
alter table public.qwen_state enable row level security;
alter table public.qwen_messages enable row level security;
alter table public.qwen_events enable row level security;

revoke all privileges on public.qwen_instances from anon, authenticated;
revoke all privileges on public.qwen_state from anon, authenticated;
revoke all privileges on public.qwen_messages from anon, authenticated;
revoke all privileges on public.qwen_events from anon, authenticated;

-- Only the owner can read their instance ID to check console access. All
-- configuration columns remain ungranted, including the local session key.
drop policy if exists "qwen_instances_no_client_access" on public.qwen_instances;
drop policy if exists "qwen_instances_owner_identity_read" on public.qwen_instances;
create policy "qwen_instances_owner_identity_read" on public.qwen_instances
  for select to authenticated
  using (owner_user_id = (select auth.uid()));
grant select (id) on public.qwen_instances to authenticated;

grant select on public.qwen_state to anon, authenticated;
grant select on public.qwen_events to anon, authenticated;
grant select on public.qwen_messages to authenticated;

drop policy if exists "qwen_state_public_read" on public.qwen_state;
create policy "qwen_state_public_read" on public.qwen_state
  for select to anon, authenticated
  using (true);

drop policy if exists "qwen_events_public_read" on public.qwen_events;
create policy "qwen_events_public_read" on public.qwen_events
  for select to anon
  using (visibility = 'public');

drop policy if exists "qwen_events_owner_read" on public.qwen_events;
create policy "qwen_events_owner_read" on public.qwen_events
  for select to authenticated
  using (visibility = 'public' or owner_user_id = (select auth.uid()));

drop policy if exists "qwen_messages_owner_read" on public.qwen_messages;
create policy "qwen_messages_owner_read" on public.qwen_messages
  for select to authenticated
  -- Only the trusted enqueue/completion RPCs write this owner ID. The previous
  -- extra lookup required a private table grant and broke owner history reads.
  using (owner_user_id = (select auth.uid()));

create or replace function public.qwen_redact_json(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_key text;
  v_value jsonb;
  v_out jsonb;
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return p_value;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    v_out := '{}'::jsonb;
    for v_key, v_value in select key, value from jsonb_each(p_value) loop
      if lower(v_key) ~ '(secret|password|authorization|private[_-]?key|api[_-]?key|access[_-]?token|refresh[_-]?token|credential[_-]?(value|secret|token|key))' then
        v_out := v_out || jsonb_build_object(v_key, '[REDACTED]');
      else
        v_out := v_out || jsonb_build_object(v_key, public.qwen_redact_json(v_value));
      end if;
    end loop;
    return v_out;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(public.qwen_redact_json(value)), '[]'::jsonb)
      into v_out
      from jsonb_array_elements(p_value);
    return v_out;
  end if;

  if jsonb_typeof(p_value) = 'string' then
    v_text := p_value #>> '{}';
    v_text := regexp_replace(v_text, '(?i)(bearer[[:space:]]+)[^[:space:]]+', '\\1[REDACTED]', 'g');
    v_text := regexp_replace(v_text, '(?i)(api[_-]?key|secret|password|private[_-]?key|access[_-]?token|refresh[_-]?token)[[:space:]]*[:=][[:space:]]*[^,;[:space:]}]+', '\\1=[REDACTED]', 'g');
    return to_jsonb(left(v_text, 16000));
  end if;

  return p_value;
end;
$$;

revoke all on function public.qwen_redact_json(jsonb) from public, anon, authenticated;

-- Keep the single qwen record tied to the already-existing PAM instance. This
-- does not create another local model or another Polymarket account.
insert into public.qwen_instances (
  id, pam_instance_id, owner_user_id, agent_id, model, session_key, objective_file
)
select
  'polymarket-qwen', p.id, p.owner_user_id, 'polymarket', 'ollama/qwen3.5:4b',
  'agent:polymarket:qwen-remote', 'OBJECTIVE.md'
from public.pam_instances p
order by p.created_at asc
limit 1
on conflict (id) do update set
  agent_id = excluded.agent_id,
  model = excluded.model,
  session_key = excluded.session_key,
  objective_file = excluded.objective_file,
  updated_at = now();

insert into public.qwen_state (qwen_id, display_name, agent_id, model, objective_json)
select
  'polymarket-qwen', 'Qwen / Polymarket US', agent_id, model,
  jsonb_build_object(
    'file', objective_file,
    'label', 'Local-model Polymarket US experiment',
    'decision_maker', 'Qwen',
    'adapter_role', 'tools, state, communication, observability, persistence',
    'trading_policy_in_wrapper', false
  )
from public.qwen_instances
where id = 'polymarket-qwen'
on conflict (qwen_id) do nothing;

-- Put the dedicated page in the Observatory directory when that table exists.
insert into public.surfaces (key, name, description, status, position)
values (
  'qwen', 'Qwen Observatory',
  'A live window into the local Qwen agent, its tools, state, and Polymarket US connection.',
  'live', 7
)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  position = excluded.position;

create or replace function public.qwen_enqueue_message(
  p_qwen_id text,
  p_body text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance public.qwen_instances%rowtype;
  v_body text := left(btrim(coalesce(p_body, '')), 8000);
  v_message_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'note', 'authentication_required');
  end if;

  select * into v_instance
  from public.qwen_instances
  where id = p_qwen_id
    and owner_user_id = (select auth.uid())
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'note', 'owner_access_required');
  end if;

  if v_body = '' then
    return jsonb_build_object('ok', false, 'note', 'empty_message');
  end if;

  insert into public.qwen_messages (
    qwen_id, owner_user_id, session_key, sender_type, body, status, provenance_tag
  ) values (
    v_instance.id, v_instance.owner_user_id, v_instance.session_key,
    'user', v_body, 'queued', 'Observed'
  ) returning id into v_message_id;

  insert into public.qwen_events (
    qwen_id, owner_user_id, message_id, visibility, event_type, status, summary, payload_json
  ) values (
    v_instance.id, v_instance.owner_user_id, v_message_id, 'public',
    'message.queued', 'queued', 'Owner message queued for the persistent Qwen session.',
    jsonb_build_object('message_id', v_message_id, 'body_chars', char_length(v_body))
  );

  return jsonb_build_object('ok', true, 'message_id', v_message_id);
end;
$$;

create or replace function public.qwen_device_context(p_device_token text)
returns table (
  qwen_id text,
  pam_instance_id uuid,
  owner_user_id uuid,
  device_id uuid
)
language sql
security definer
set search_path = public
as $$
  select i.id, t.pam_instance_id, t.owner_user_id, t.device_id
  from public.pam_device_tokens t
  join public.pam_devices d on d.id = t.device_id
  join public.qwen_instances i on i.pam_instance_id = t.pam_instance_id
  where nullif(btrim(p_device_token), '') is not null
    and char_length(btrim(p_device_token)) >= 20
    and t.token_hash = encode(extensions.digest(btrim(p_device_token), 'sha256'), 'hex')
    and t.revoked_at is null
  limit 1;
$$;

revoke all on function public.qwen_device_context(text) from public, anon, authenticated;

create or replace function public.qwen_agent_poll(
  p_device_token text,
  p_limit integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
  v_messages jsonb;
begin
  select * into v_ctx from public.qwen_device_context(p_device_token) limit 1;
  if v_ctx.qwen_id is null then
    return jsonb_build_object('ok', false, 'note', 'invalid_device_token');
  end if;

  update public.qwen_messages
     set status = 'queued', started_at = null, error_text = 'claim_expired'
   where qwen_id = v_ctx.qwen_id
     and status = 'processing'
     and started_at < now() - interval '10 minutes';

  update public.pam_device_tokens
     set last_used_at = now()
   where device_id = v_ctx.device_id;

  update public.pam_devices
     set status = 'online', last_seen_at = now(), updated_at = now()
   where id = v_ctx.device_id;

  with claimed as (
    select id
    from public.qwen_messages
    where qwen_id = v_ctx.qwen_id
      and status = 'queued'
    order by created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 1), 4))
  ), updated as (
    update public.qwen_messages m
       set status = 'processing', started_at = now(), error_text = null
      from claimed c
     where m.id = c.id
    returning m.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'qwen_id', qwen_id,
        'session_key', session_key,
        'body', body,
        'created_at', created_at,
        'status', status
      ) order by created_at
    ), '[]'::jsonb
  ) into v_messages
  from updated;

  return jsonb_build_object('ok', true, 'qwen_id', v_ctx.qwen_id, 'messages', v_messages);
end;
$$;

create or replace function public.qwen_agent_set_state(
  p_device_token text,
  p_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
  v_state jsonb := public.qwen_redact_json(coalesce(p_state, '{}'::jsonb));
  v_now timestamptz := now();
begin
  select * into v_ctx from public.qwen_device_context(p_device_token) limit 1;
  if v_ctx.qwen_id is null then
    return jsonb_build_object('ok', false, 'note', 'invalid_device_token');
  end if;

  update public.qwen_state
     set status = case
         when v_state->>'status' in ('offline', 'starting', 'online', 'degraded', 'error')
           then v_state->>'status'
         else 'online'
       end,
         components_json = coalesce(v_state->'components', components_json),
         account_json = coalesce(v_state->'account', account_json),
         portfolio_json = coalesce(v_state->'portfolio', portfolio_json),
         activity_json = coalesce(v_state->'activity', activity_json),
         objective_json = coalesce(v_state->'objective', objective_json),
         error_json = coalesce(v_state->'errors', error_json),
         retry_json = coalesce(v_state->'retries', retry_json),
         last_seen_at = v_now,
         updated_at = v_now
   where qwen_id = v_ctx.qwen_id;

  update public.qwen_instances
     set status = case
         when v_state->>'status' in ('offline', 'starting', 'online', 'degraded', 'error')
           then v_state->>'status'
         else 'online'
       end,
         updated_at = v_now
   where id = v_ctx.qwen_id;

  update public.pam_devices
     set status = 'online', last_seen_at = v_now, updated_at = v_now
   where id = v_ctx.device_id;

  return jsonb_build_object('ok', true, 'qwen_id', v_ctx.qwen_id, 'updated_at', v_now);
end;
$$;

create or replace function public.qwen_agent_ingest_event(
  p_device_token text,
  p_event_type text,
  p_status text,
  p_summary text,
  p_payload jsonb default '{}'::jsonb,
  p_visibility text default 'public',
  p_message_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
  v_id bigint;
  v_status text := case
    when p_status in ('info', 'queued', 'running', 'succeeded', 'failed') then p_status
    else 'info'
  end;
  v_visibility text := case when p_visibility = 'owner' then 'owner' else 'public' end;
begin
  select * into v_ctx from public.qwen_device_context(p_device_token) limit 1;
  if v_ctx.qwen_id is null then
    return jsonb_build_object('ok', false, 'note', 'invalid_device_token');
  end if;

  insert into public.qwen_events (
    qwen_id, owner_user_id, message_id, visibility, event_type, status, summary, payload_json
  ) values (
    v_ctx.qwen_id, v_ctx.owner_user_id, p_message_id, v_visibility,
    left(coalesce(nullif(btrim(p_event_type), ''), 'event'), 120), v_status,
    left(coalesce(p_summary, ''), 600), public.qwen_redact_json(coalesce(p_payload, '{}'::jsonb))
  ) returning id into v_id;

  update public.pam_device_tokens set last_used_at = now() where device_id = v_ctx.device_id;
  update public.pam_devices set status = 'online', last_seen_at = now(), updated_at = now()
   where id = v_ctx.device_id;

  return jsonb_build_object('ok', true, 'event_id', v_id);
end;
$$;

create or replace function public.qwen_agent_complete(
  p_device_token text,
  p_message_id uuid,
  p_status text,
  p_reply text default null,
  p_error text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
  v_original public.qwen_messages%rowtype;
  v_reply text := left(btrim(coalesce(p_reply, '')), 8000);
  v_error text := left(btrim(coalesce(p_error, '')), 1000);
  v_reply_id uuid;
begin
  select * into v_ctx from public.qwen_device_context(p_device_token) limit 1;
  if v_ctx.qwen_id is null then
    return jsonb_build_object('ok', false, 'note', 'invalid_device_token');
  end if;

  select * into v_original
  from public.qwen_messages
  where id = p_message_id
    and qwen_id = v_ctx.qwen_id
    and owner_user_id = v_ctx.owner_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'note', 'message_not_found');
  end if;

  update public.qwen_messages
     set status = case when p_status = 'completed' and v_reply <> '' then 'completed' else 'failed' end,
         error_text = nullif(v_error, ''),
         completed_at = now()
   where id = v_original.id;

  if p_status = 'completed' and v_reply <> '' then
    insert into public.qwen_messages (
      qwen_id, owner_user_id, session_key, sender_type, body, status,
      provenance_tag, response_to_id, created_at, completed_at
    ) values (
      v_ctx.qwen_id, v_ctx.owner_user_id, v_original.session_key, 'qwen', v_reply,
      'completed', 'Observed', v_original.id, now(), now()
    ) returning id into v_reply_id;
  end if;

  update public.qwen_state
     set activity_json = jsonb_build_object(
       'phase', case when p_status = 'completed' and v_reply <> '' then 'idle' else 'error' end,
       'label', case when p_status = 'completed' and v_reply <> '' then 'Waiting for owner message' else 'Qwen bridge needs attention' end,
       'message_id', v_original.id,
       'updated_at', now()
     ),
     updated_at = now()
   where qwen_id = v_ctx.qwen_id;

  return jsonb_build_object('ok', true, 'reply_id', v_reply_id, 'status',
    case when p_status = 'completed' and v_reply <> '' then 'completed' else 'failed' end);
end;
$$;

revoke all on function public.qwen_enqueue_message(text, text) from public;
revoke all on function public.qwen_enqueue_message(text, text) from anon;
grant execute on function public.qwen_enqueue_message(text, text) to authenticated;
revoke all on function public.qwen_agent_poll(text, integer) from public;
grant execute on function public.qwen_agent_poll(text, integer) to anon, authenticated;
revoke all on function public.qwen_agent_set_state(text, jsonb) from public;
grant execute on function public.qwen_agent_set_state(text, jsonb) to anon, authenticated;
revoke all on function public.qwen_agent_ingest_event(text, text, text, text, jsonb, text, uuid) from public;
grant execute on function public.qwen_agent_ingest_event(text, text, text, text, jsonb, text, uuid) to anon, authenticated;
revoke all on function public.qwen_agent_complete(text, uuid, text, text, text) from public;
grant execute on function public.qwen_agent_complete(text, uuid, text, text, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'qwen_state'
  ) then
    alter publication supabase_realtime add table public.qwen_state;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'qwen_events'
  ) then
    alter publication supabase_realtime add table public.qwen_events;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'qwen_messages'
  ) then
    alter publication supabase_realtime add table public.qwen_messages;
  end if;
end $$;
