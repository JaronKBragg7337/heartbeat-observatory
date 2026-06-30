-- PAM local-agent heartbeat v0
-- Pairs a local desktop agent by device token hash, without exposing Supabase
-- service-role credentials to Vercel or the local machine.

create table if not exists public.pam_device_tokens (
  id uuid primary key default gen_random_uuid(),
  pam_instance_id uuid not null references public.pam_instances(id) on delete cascade,
  device_id uuid not null unique references public.pam_devices(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'desktop agent',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pam_device_tokens_instance_idx on public.pam_device_tokens(pam_instance_id);
create index if not exists pam_device_tokens_owner_idx on public.pam_device_tokens(owner_user_id);
create index if not exists pam_device_tokens_hash_idx on public.pam_device_tokens(token_hash);

alter table public.pam_device_tokens enable row level security;

revoke all privileges on public.pam_device_tokens from anon, authenticated;

drop policy if exists "pam_device_tokens_no_client_access" on public.pam_device_tokens;
create policy "pam_device_tokens_no_client_access" on public.pam_device_tokens
  for all to authenticated
  using (false)
  with check (false);

create or replace function public.pam_agent_heartbeat(
  p_device_token text,
  p_device_name text default null,
  p_platform text default null,
  p_capabilities jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.pam_device_tokens%rowtype;
  v_now timestamptz := now();
  v_event_id uuid;
begin
  if p_device_token is null or length(trim(p_device_token)) < 20 then
    return jsonb_build_object('ok', false, 'note', 'missing_device_token');
  end if;

  select *
    into v_token
    from public.pam_device_tokens
   where token_hash = encode(digest(trim(p_device_token), 'sha256'), 'hex')
     and revoked_at is null
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'note', 'invalid_device_token');
  end if;

  update public.pam_device_tokens
     set last_used_at = v_now
   where id = v_token.id;

  update public.pam_devices
     set device_name = coalesce(nullif(trim(p_device_name), ''), device_name),
         platform = coalesce(nullif(trim(p_platform), ''), platform),
         capabilities_json = coalesce(p_capabilities, '{}'::jsonb),
         status = 'online',
         last_seen_at = v_now,
         updated_at = v_now
   where id = v_token.device_id;

  insert into public.pam_events (
    pam_instance_id,
    owner_user_id,
    target_device_id,
    source_device_id,
    event_type,
    payload_json,
    status,
    created_at,
    completed_at
  ) values (
    v_token.pam_instance_id,
    v_token.owner_user_id,
    v_token.device_id,
    v_token.device_id,
    'device.heartbeat',
    jsonb_build_object(
      'device_name', coalesce(nullif(trim(p_device_name), ''), 'desktop agent'),
      'platform', p_platform,
      'capabilities', coalesce(p_capabilities, '{}'::jsonb)
    ),
    'succeeded',
    v_now,
    v_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'note', 'heartbeat_recorded',
    'pam_instance_id', v_token.pam_instance_id,
    'device_id', v_token.device_id,
    'event_id', v_event_id
  );
end;
$$;

revoke all on function public.pam_agent_heartbeat(text, text, text, jsonb) from public;
grant execute on function public.pam_agent_heartbeat(text, text, text, jsonb) to anon, authenticated;
