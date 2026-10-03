-- Apply once using the Supabase SQL editor. No browser role can call these RPCs.
begin;
create table if not exists public.cosmos_worlds (
  world_id text primary key, revision bigint not null, record jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.cosmos_players (
  world_id text references public.cosmos_worlds on delete cascade,
  player_id text, device_hash text not null, ship_id text not null, aboard_ship_id text,
  seat text, record jsonb not null, primary key(world_id,player_id),
  unique(world_id,device_hash), unique(world_id,aboard_ship_id,seat)
);
create table if not exists public.cosmos_ships (
  world_id text references public.cosmos_worlds on delete cascade,
  ship_id text, owner_id text not null, ship_type text not null, record jsonb not null,
  primary key(world_id,ship_id), unique(world_id,owner_id)
);
create table if not exists public.cosmos_pads (
  world_id text references public.cosmos_worlds on delete cascade,
  pad_id text, ship_id text not null, record jsonb not null,
  primary key(world_id,pad_id), unique(world_id,ship_id)
);
create table if not exists public.cosmos_crew_contracts (
  world_id text references public.cosmos_worlds on delete cascade,
  candidate_id text, ship_id text not null, role text not null, record jsonb not null,
  primary key(world_id,candidate_id), unique(world_id,ship_id,role)
);
create table if not exists public.cosmos_accounts (
  world_id text references public.cosmos_worlds on delete cascade,
  ship_id text, marks bigint not null check(marks>=0), record jsonb not null,
  primary key(world_id,ship_id)
);
create table if not exists public.cosmos_quests (
  world_id text references public.cosmos_worlds on delete cascade,
  ship_id text, quest_id text, record jsonb not null, primary key(world_id,ship_id,quest_id)
);
create table if not exists public.cosmos_damage (
  world_id text references public.cosmos_worlds on delete cascade,
  damage_id text, record jsonb not null, primary key(world_id,damage_id)
);
create table if not exists public.cosmos_terrain_bricks (
  world_id text references public.cosmos_worlds on delete cascade,
  brick_key text, body_id text not null, revision bigint not null, record jsonb not null,
  primary key(world_id,brick_key)
);
create table if not exists public.cosmos_action_receipts (
  world_id text references public.cosmos_worlds on delete cascade,
  player_id text, action_id text, revision bigint not null, result jsonb not null,
  primary key(world_id,player_id,action_id)
);
-- Explicit grants and RLS cover both old automatic grants and new opt-in projects.
do $$ declare t text; begin
  foreach t in array array['cosmos_worlds','cosmos_players','cosmos_ships','cosmos_pads',
    'cosmos_crew_contracts','cosmos_accounts','cosmos_quests','cosmos_damage',
    'cosmos_terrain_bricks','cosmos_action_receipts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update, delete on public.%I to service_role',t);
  end loop;
end $$;
create or replace function public.cosmos_load(wid text) returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('record',(select record from public.cosmos_worlds where world_id=wid),
    'bricks',coalesce((select jsonb_agg(record) from public.cosmos_terrain_bricks where world_id=wid),'[]'::jsonb));
$$;
create or replace function public.cosmos_save(wid text, expected bigint, rec jsonb, changed jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare current_rev bigint; kv record; ship jsonb; c jsonb; b jsonb; q record;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cosmos:'||wid,0));
  select revision into current_rev from public.cosmos_worlds where world_id=wid for update;
  if current_rev is distinct from expected then raise exception 'World revision conflict'; end if;
  if (rec->>'schema')::int<>2 or (current_rev is not null and (rec->>'revision')::bigint<=current_rev)
    then raise exception 'Invalid world revision'; end if;
  insert into public.cosmos_worlds values(wid,(rec->>'revision')::bigint,rec,now())
    on conflict(world_id) do update set revision=excluded.revision, record=excluded.record, updated_at=excluded.updated_at;
  -- A player, ship or pad that left the world record (start fresh, a deleted throwaway) leaves the projections too, so a new player can reuse its device hash.
  delete from public.cosmos_players where world_id=wid and not jsonb_exists(rec->'players',player_id);
  delete from public.cosmos_quests where world_id=wid and not jsonb_exists(rec->'ships',ship_id);
  delete from public.cosmos_accounts where world_id=wid and not jsonb_exists(rec->'ships',ship_id);
  delete from public.cosmos_ships where world_id=wid and not jsonb_exists(rec->'ships',ship_id);
  -- Every pad is free until the loop below says whose it is (a pad can change hands within one save).
  update public.cosmos_pads set ship_id='free:'||pad_id where world_id=wid;
  -- Clear seat projections together before upsert so handing over a seat is atomic.
  update public.cosmos_players set seat=null where world_id=wid;
  for kv in select * from jsonb_each(rec->'players') loop
    insert into public.cosmos_players values(wid,kv.key,kv.value->>'deviceHash',kv.value->>'shipId',
      kv.value->>'aboardShipId',kv.value->'pose'->>'seat',kv.value)
    on conflict(world_id,player_id) do update set device_hash=excluded.device_hash,ship_id=excluded.ship_id,
      aboard_ship_id=excluded.aboard_ship_id,seat=excluded.seat,record=excluded.record;
  end loop;
  delete from public.cosmos_crew_contracts where world_id=wid;
  for kv in select * from jsonb_each(rec->'ships') loop
    ship=kv.value;
    insert into public.cosmos_ships values(wid,kv.key,ship->>'owner',ship->>'type',ship)
      on conflict(world_id,ship_id) do update set record=excluded.record,ship_type=excluded.ship_type;
    insert into public.cosmos_accounts values(wid,kv.key,(ship->'economy'->>'marks')::bigint,ship->'economy')
      on conflict(world_id,ship_id) do update set marks=excluded.marks,record=excluded.record;
    for c in select * from jsonb_array_elements(ship->'crew') loop
      insert into public.cosmos_crew_contracts values(wid,c->>'id',kv.key,c->>'role',c);
    end loop;
    for q in select * from jsonb_each(ship->'economy'->'quests') loop
      insert into public.cosmos_quests values(wid,kv.key,q.key,q.value)
        on conflict(world_id,ship_id,quest_id) do update set record=excluded.record;
    end loop;
  end loop;
  for b in select * from jsonb_array_elements(rec->'pads') loop
    insert into public.cosmos_pads values(wid,b->>'id',coalesce(b->>'shipId','free:'||(b->>'id')),b)
      on conflict(world_id,pad_id) do update set ship_id=excluded.ship_id,record=excluded.record;
  end loop;
  for kv in select * from jsonb_each(rec->'damage') loop
    insert into public.cosmos_damage values(wid,kv.key,kv.value)
      on conflict(world_id,damage_id) do update set record=excluded.record;
  end loop;
  for b in select * from jsonb_array_elements(changed) loop
    insert into public.cosmos_terrain_bricks values(wid,b->>'key',b->>'bodyId',(rec->>'revision')::bigint,b)
      on conflict(world_id,brick_key) do update set record=excluded.record,revision=excluded.revision;
  end loop;
  for kv in select * from jsonb_each(rec->'receipts') loop
    insert into public.cosmos_action_receipts values(wid,kv.value->>'playerId',kv.value->>'actionId',
      (kv.value->>'revision')::bigint,kv.value->'result') on conflict do nothing;
  end loop;
end $$;
revoke all on function public.cosmos_load(text) from public, anon, authenticated;
revoke all on function public.cosmos_save(text,bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.cosmos_load(text) to service_role;
grant execute on function public.cosmos_save(text,bigint,jsonb,jsonb) to service_role;
commit;
