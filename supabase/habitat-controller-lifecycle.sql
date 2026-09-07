-- Habitat controller lifecycle synchronization
-- Applied to the live Heartbeat Supabase project on 2026-09-07.
--
-- Purpose:
--   1. mark a body as mind=attached while a real controller session is alive;
--   2. emit controller.attached for genuinely new sessions;
--   3. close expired sessions and return the durable body to mind=not_attached;
--   4. preserve position, events and private memories after disconnection.

create or replace function public.habitat_controller_heartbeat(
  p_controller_token text,
  p_actor_key text,
  p_session_key text,
  p_provider text default null,
  p_model text default null,
  p_capabilities jsonb default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token public.habitat_controller_tokens%rowtype;
  v_actor public.habitat_actors%rowtype;
  v_body public.habitat_bodies%rowtype;
  v_caps jsonb;
  v_session uuid;
  v_was_existing boolean;
begin
  if p_controller_token is null or length(trim(p_controller_token)) < 20 then
    return jsonb_build_object('ok', false, 'note', 'missing_controller_token');
  end if;
  if p_session_key is null or length(trim(p_session_key)) < 3 then
    return jsonb_build_object('ok', false, 'note', 'missing_session_key');
  end if;

  select * into v_token
  from public.habitat_controller_tokens
  where token_hash = encode(digest(trim(p_controller_token), 'sha256'), 'hex')
    and revoked_at is null
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'note', 'invalid_controller_token');
  end if;

  select * into v_actor
  from public.habitat_actors
  where id = v_token.actor_id and actor_key = p_actor_key
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'note', 'actor_scope_mismatch');
  end if;

  select * into v_body
  from public.habitat_bodies
  where actor_id = v_actor.id
  order by created_at
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'note', 'actor_has_no_body');
  end if;

  v_caps := coalesce(p_capabilities, v_token.capabilities_json, '[]'::jsonb);
  select exists(
    select 1 from public.habitat_controller_sessions
    where session_key = trim(p_session_key)
  ) into v_was_existing;

  update public.habitat_controller_tokens
  set last_used_at = now()
  where id = v_token.id;

  update public.habitat_actors
  set status = 'active', last_seen_at = now(), updated_at = now()
  where id = v_actor.id;

  insert into public.habitat_controller_sessions(
    session_key, controller_token_id, actor_id, body_id,
    provider, model, status, capabilities_json, metadata_json,
    connected_at, last_seen_at, closed_at
  ) values (
    trim(p_session_key), v_token.id, v_actor.id, v_body.id,
    nullif(trim(p_provider), ''), nullif(trim(p_model), ''), 'active',
    v_caps, coalesce(p_metadata, '{}'::jsonb), now(), now(), null
  )
  on conflict (session_key) do update set
    controller_token_id = excluded.controller_token_id,
    actor_id = excluded.actor_id,
    body_id = excluded.body_id,
    provider = excluded.provider,
    model = excluded.model,
    status = 'active',
    capabilities_json = excluded.capabilities_json,
    metadata_json = excluded.metadata_json,
    last_seen_at = now(),
    closed_at = null
  returning id into v_session;

  update public.habitat_bodies
  set state_json = state_json || jsonb_build_object(
        'mind', 'attached',
        'mode', 'awake',
        'animation', case when state_json->>'animation' = 'walk' then 'walk' else 'idle' end,
        'controller', jsonb_build_object(
          'provider', nullif(trim(p_provider), ''),
          'model', nullif(trim(p_model), ''),
          'session_key', trim(p_session_key)
        )
      ),
      updated_at = now()
  where id = v_body.id;

  if not v_was_existing then
    insert into public.habitat_events(world_id, actor_id, body_id, event_type, payload_json)
    select b.world_id, v_actor.id, v_body.id, 'controller.attached',
      jsonb_build_object(
        'provider', nullif(trim(p_provider), ''),
        'model', nullif(trim(p_model), ''),
        'session_key', trim(p_session_key)
      )
    from public.habitat_bodies b
    where b.id = v_body.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'note', 'heartbeat_recorded',
    'session_id', v_session,
    'actor', v_actor.actor_key,
    'body', v_body.body_key,
    'new_session', not v_was_existing
  );
end;
$$;

grant execute on function public.habitat_controller_heartbeat(text,text,text,text,text,jsonb,jsonb)
  to anon, authenticated;

create or replace function public.habitat_world_heartbeat()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.habitat_worlds
  set tick = tick + 1, updated_at = now()
  where status = 'live';

  update public.habitat_controller_sessions
  set status = 'closed', closed_at = now()
  where status = 'active'
    and last_seen_at < now() - interval '5 minutes';

  update public.habitat_bodies b
  set state_json = (b.state_json - 'controller') || jsonb_build_object(
        'mind', 'not_attached',
        'mode', 'dormant',
        'animation', 'idle'
      ),
      updated_at = now()
  where b.state_json->>'mind' = 'attached'
    and not exists (
      select 1
      from public.habitat_controller_sessions s
      where s.actor_id = b.actor_id
        and s.body_id = b.id
        and s.status = 'active'
    );

  update public.habitat_actors a
  set status = 'offline', updated_at = now()
  where a.status = 'active'
    and not exists (
      select 1
      from public.habitat_controller_sessions s
      where s.actor_id = a.id
        and s.status = 'active'
    );
end;
$$;

revoke all on function public.habitat_world_heartbeat() from public, anon, authenticated;
