-- PAM control plane v0
-- Purpose: replace the temporary tunnel with durable account/device/event state.
-- Apply in Supabase SQL editor after review.

create extension if not exists pgcrypto;

create table if not exists public.pam_instances (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null default 'PAM',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pam_devices (
  id uuid primary key default gen_random_uuid(),
  pam_instance_id uuid not null references public.pam_instances(id) on delete cascade,
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_name text not null,
  device_type text not null check (device_type in ('desktop', 'phone', 'web', 'sim', 'worker')),
  platform text,
  capabilities_json jsonb not null default '{}'::jsonb,
  pairing_state text not null default 'paired',
  status text not null default 'offline',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pam_threads (
  id uuid primary key default gen_random_uuid(),
  pam_instance_id uuid not null references public.pam_instances(id) on delete cascade,
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  active_device_id uuid references public.pam_devices(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pam_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.pam_threads(id) on delete cascade,
  pam_instance_id uuid not null references public.pam_instances(id) on delete cascade,
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'pam', 'device', 'worker', 'system')),
  sender_device_id uuid references public.pam_devices(id) on delete set null,
  body text not null,
  provenance_tag text not null default 'Observed' check (provenance_tag in ('Observed', 'Inferred', 'Assumed', 'Unknown')),
  created_at timestamptz not null default now()
);

create table if not exists public.pam_events (
  id uuid primary key default gen_random_uuid(),
  pam_instance_id uuid not null references public.pam_instances(id) on delete cascade,
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_device_id uuid references public.pam_devices(id) on delete set null,
  source_device_id uuid references public.pam_devices(id) on delete set null,
  thread_id uuid references public.pam_threads(id) on delete set null,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'claimed', 'running', 'succeeded', 'failed', 'needs_user')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.pam_action_ledger (
  id uuid primary key default gen_random_uuid(),
  pam_instance_id uuid not null references public.pam_instances(id) on delete cascade,
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_id uuid references public.pam_devices(id) on delete set null,
  event_id uuid references public.pam_events(id) on delete set null,
  action_kind text not null,
  boundary text not null check (boundary in ('reversible_local', 'outward_irreversible')),
  proposal_json jsonb not null default '{}'::jsonb,
  receipt_json jsonb not null default '{}'::jsonb,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists pam_instances_owner_idx on public.pam_instances(owner_user_id);
create index if not exists pam_devices_instance_idx on public.pam_devices(pam_instance_id, owner_user_id);
create index if not exists pam_devices_owner_idx on public.pam_devices(owner_user_id);
create index if not exists pam_threads_instance_idx on public.pam_threads(pam_instance_id, owner_user_id, updated_at desc);
create index if not exists pam_threads_owner_idx on public.pam_threads(owner_user_id);
create index if not exists pam_threads_active_device_idx on public.pam_threads(active_device_id);
create index if not exists pam_messages_thread_idx on public.pam_messages(thread_id, created_at);
create index if not exists pam_messages_instance_idx on public.pam_messages(pam_instance_id);
create index if not exists pam_messages_owner_idx on public.pam_messages(owner_user_id);
create index if not exists pam_messages_sender_device_idx on public.pam_messages(sender_device_id);
create index if not exists pam_events_claim_idx on public.pam_events(pam_instance_id, target_device_id, status, created_at);
create index if not exists pam_events_owner_idx on public.pam_events(owner_user_id);
create index if not exists pam_events_target_device_idx on public.pam_events(target_device_id);
create index if not exists pam_events_source_device_idx on public.pam_events(source_device_id);
create index if not exists pam_events_thread_idx on public.pam_events(thread_id);
create index if not exists pam_action_ledger_instance_idx on public.pam_action_ledger(pam_instance_id, created_at desc);
create index if not exists pam_action_ledger_owner_idx on public.pam_action_ledger(owner_user_id);
create index if not exists pam_action_ledger_device_idx on public.pam_action_ledger(device_id);
create index if not exists pam_action_ledger_event_idx on public.pam_action_ledger(event_id);

alter table public.pam_instances enable row level security;
alter table public.pam_devices enable row level security;
alter table public.pam_threads enable row level security;
alter table public.pam_messages enable row level security;
alter table public.pam_events enable row level security;
alter table public.pam_action_ledger enable row level security;

grant usage on schema public to authenticated;

revoke all privileges on public.pam_instances from anon, authenticated;
revoke all privileges on public.pam_devices from anon, authenticated;
revoke all privileges on public.pam_threads from anon, authenticated;
revoke all privileges on public.pam_messages from anon, authenticated;
revoke all privileges on public.pam_events from anon, authenticated;
revoke all privileges on public.pam_action_ledger from anon, authenticated;

grant select, insert, update, delete on public.pam_instances to authenticated;
grant select, insert, update, delete on public.pam_devices to authenticated;
grant select, insert, update, delete on public.pam_threads to authenticated;
grant select, insert, update, delete on public.pam_messages to authenticated;
grant select, insert, update, delete on public.pam_events to authenticated;
grant select, insert, update, delete on public.pam_action_ledger to authenticated;

drop policy if exists "pam_instances_owner_all" on public.pam_instances;
create policy "pam_instances_owner_all" on public.pam_instances
  for all to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "pam_devices_owner_all" on public.pam_devices;
create policy "pam_devices_owner_all" on public.pam_devices
  for all to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "pam_threads_owner_all" on public.pam_threads;
create policy "pam_threads_owner_all" on public.pam_threads
  for all to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "pam_messages_owner_all" on public.pam_messages;
create policy "pam_messages_owner_all" on public.pam_messages
  for all to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "pam_events_owner_all" on public.pam_events;
create policy "pam_events_owner_all" on public.pam_events
  for all to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "pam_action_ledger_owner_all" on public.pam_action_ledger;
create policy "pam_action_ledger_owner_all" on public.pam_action_ledger
  for all to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pam_devices'
  ) then
    alter publication supabase_realtime add table public.pam_devices;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pam_messages'
  ) then
    alter publication supabase_realtime add table public.pam_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pam_events'
  ) then
    alter publication supabase_realtime add table public.pam_events;
  end if;
end $$;
