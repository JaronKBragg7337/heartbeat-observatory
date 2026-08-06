-- ===========================================================================
-- World 3 (Ashgrove) - the shared town and its job seats
-- ===========================================================================
-- PART 1 is ALREADY APPLIED to the live project (ygjpnvrwhkrowkrskftk).
-- PART 2 is NOT applied yet. It was blocked by a permission gate during the
-- session that wrote it - deliberately, because it creates security-definer
-- functions on the production database. Read it, then apply it from the
-- Supabase SQL editor. Until it is applied the tables are read-only, which is
-- a safe state: World 3 plays fine, only cross-player growth sync waits.
-- ===========================================================================


-- ---------------------------------------------------------------- PART 1 --
-- APPLIED. Recorded here so the schema lives in the repo, not just in the DB.
--
-- create table public.world3_world (
--   id text primary key default 'main',
--   seed text not null,
--   town_seed text not null,
--   day integer not null default 0 check (day >= 0),
--   digest text not null default '',
--   founding jsonb not null default '[]'::jsonb,
--   records jsonb not null default '[]'::jsonb,
--   log jsonb not null default '[]'::jsonb,
--   sim_snapshot jsonb,
--   world_day_ms bigint not null default 86400000 check (world_day_ms > 0),
--   genesis_at timestamptz not null default now(),
--   last_advanced_at timestamptz not null default now(),
--   updated_at timestamptz not null default now(),
--   check (jsonb_typeof(founding) = 'array'),
--   check (jsonb_typeof(records)  = 'array'),
--   check (jsonb_typeof(log)      = 'array')
-- );
--
-- create table public.world3_seats (
--   seat_id text primary key,
--   business_id text not null,
--   holder_uid uuid references auth.users (id) on delete set null,
--   displaced_npc_id text,
--   taken_at timestamptz,
--   last_worked_day integer,
--   updated_at timestamptz not null default now()
-- );
--
-- create unique index world3_seats_one_seat_per_player
--   on public.world3_seats (holder_uid) where holder_uid is not null;
-- create index world3_seats_business_idx on public.world3_seats (business_id);
--
-- alter table public.world3_world enable row level security;
-- alter table public.world3_seats enable row level security;
-- create policy "The shared town is readable by everyone"
--   on public.world3_world for select to anon, authenticated using (true);
-- create policy "Seats are readable by everyone"
--   on public.world3_seats for select to anon, authenticated using (true);
-- grant select on public.world3_world, public.world3_seats to anon, authenticated;


-- ---------------------------------------------------------------- PART 2 --
-- NOT APPLIED. The write paths. Neither table has a write policy, so these
-- functions are the only way to change World 3 - livi-organism's pattern:
-- security definer inside a revoked private schema, exposed through a thin
-- invoker wrapper, so every rule lives in one auditable place.

create schema if not exists world3_private;
revoke all on schema world3_private from public, anon, authenticated;

create or replace function world3_private.found_internal(
  p_seed text, p_town_seed text, p_founding jsonb, p_sim_snapshot jsonb, p_digest text
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v public.world3_world%rowtype;
begin
  select * into v from public.world3_world where id = 'main';
  if found then
    return jsonb_build_object('status','exists','day',v.day,'digest',v.digest);
  end if;
  insert into public.world3_world (id, seed, town_seed, founding, sim_snapshot, digest)
  values ('main', p_seed, p_town_seed, coalesce(p_founding,'[]'::jsonb), p_sim_snapshot, coalesce(p_digest,''))
  on conflict (id) do nothing;
  select * into v from public.world3_world where id = 'main';
  return jsonb_build_object('status','founded','day',v.day,'digest',v.digest);
end;
$fn$;

-- Advance the town. Three guards, in order:
--   1. Optimistic lock - the caller names the digest it advanced FROM, so two
--      players stepping the same day cannot both win.
--   2. Forward only.
--   3. Never ahead of real time - one day per world_day_ms from genesis, so
--      nobody can fast-forward the town by lying about it.
--
-- TRUST BOUNDARY, stated plainly: the day is computed by the client's copy of
-- the Ashgrove engine, so this trusts the SUBMITTED snapshot. It guarantees
-- one shared town and that time cannot be rushed; it does not yet prove the
-- state was computed honestly. Moving the step into a scheduled edge function
-- - the pattern the_current_world already uses in this same project - is what
-- closes it.
create or replace function world3_private.advance_internal(
  p_from_digest text, p_day integer, p_digest text,
  p_records jsonb, p_log jsonb, p_sim_snapshot jsonb, p_founding jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v public.world3_world%rowtype; v_due integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to advance the town' using errcode = '28000';
  end if;
  select * into v from public.world3_world where id = 'main' for update;
  if not found then
    raise exception 'The town has not been founded yet' using errcode = 'P0002';
  end if;
  if v.digest is distinct from p_from_digest then
    return jsonb_build_object('status','stale','day',v.day,'digest',v.digest);
  end if;
  if p_day <= v.day then
    return jsonb_build_object('status','behind','day',v.day,'digest',v.digest);
  end if;
  v_due := floor(extract(epoch from (now() - v.genesis_at)) * 1000 / v.world_day_ms);
  if p_day > v_due then
    return jsonb_build_object('status','too-early','day',v.day,'due',v_due);
  end if;
  update public.world3_world set
    day = p_day, digest = p_digest,
    records = coalesce(p_records, records),
    log = coalesce(p_log, log),
    sim_snapshot = coalesce(p_sim_snapshot, sim_snapshot),
    founding = case when jsonb_array_length(founding) = 0
                    then coalesce(p_founding, founding) else founding end,
    last_advanced_at = now(), updated_at = now()
  where id = 'main';
  return jsonb_build_object('status','advanced','day',p_day,'digest',p_digest);
end;
$fn$;

-- Take a job seat. Releases whatever seat the caller held, then claims the
-- target only if it is free. The partial unique index is the real referee:
-- two players can never hold one seat, one player can never hold two.
create or replace function world3_private.take_seat_internal(
  p_seat_id text, p_business_id text, p_npc_id text, p_day integer
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid := auth.uid(); v_holder uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to take a job' using errcode = '28000';
  end if;
  update public.world3_seats set holder_uid = null, taken_at = null, updated_at = now()
   where holder_uid = v_uid and seat_id <> p_seat_id;
  insert into public.world3_seats (seat_id, business_id, displaced_npc_id, holder_uid, taken_at, last_worked_day, updated_at)
  values (p_seat_id, p_business_id, p_npc_id, v_uid, now(), p_day, now())
  on conflict (seat_id) do update
    set holder_uid = excluded.holder_uid,
        displaced_npc_id = coalesce(public.world3_seats.displaced_npc_id, excluded.displaced_npc_id),
        taken_at = excluded.taken_at, last_worked_day = excluded.last_worked_day, updated_at = now()
    where public.world3_seats.holder_uid is null
       or public.world3_seats.holder_uid = excluded.holder_uid;
  select holder_uid into v_holder from public.world3_seats where seat_id = p_seat_id;
  if v_holder is distinct from v_uid then
    return jsonb_build_object('status','taken','seat',p_seat_id);
  end if;
  return jsonb_build_object('status','held','seat',p_seat_id);
end;
$fn$;

create or replace function world3_private.release_seat_internal()
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  update public.world3_seats set holder_uid = null, taken_at = null, updated_at = now()
   where holder_uid = v_uid;
  get diagnostics v_count = row_count;
  return jsonb_build_object('status','released','seats',v_count);
end;
$fn$;

create or replace function public.world3_found(
  p_seed text, p_town_seed text, p_founding jsonb default '[]'::jsonb,
  p_sim_snapshot jsonb default null, p_digest text default ''
) returns jsonb language sql security invoker set search_path = '' as $fn$
  select world3_private.found_internal(p_seed, p_town_seed, p_founding, p_sim_snapshot, p_digest);
$fn$;

create or replace function public.world3_advance_day(
  p_from_digest text, p_day integer, p_digest text,
  p_records jsonb default null, p_log jsonb default null,
  p_sim_snapshot jsonb default null, p_founding jsonb default null
) returns jsonb language sql security invoker set search_path = '' as $fn$
  select world3_private.advance_internal(p_from_digest, p_day, p_digest, p_records, p_log, p_sim_snapshot, p_founding);
$fn$;

create or replace function public.world3_take_seat(
  p_seat_id text, p_business_id text, p_npc_id text default null, p_day integer default 0
) returns jsonb language sql security invoker set search_path = '' as $fn$
  select world3_private.take_seat_internal(p_seat_id, p_business_id, p_npc_id, p_day);
$fn$;

create or replace function public.world3_release_seat()
returns jsonb language sql security invoker set search_path = '' as $fn$
  select world3_private.release_seat_internal();
$fn$;

grant usage on schema world3_private to authenticated;
grant execute on function world3_private.found_internal(text,text,jsonb,jsonb,text) to authenticated;
grant execute on function world3_private.advance_internal(text,integer,text,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function world3_private.take_seat_internal(text,text,text,integer) to authenticated;
grant execute on function world3_private.release_seat_internal() to authenticated;

revoke all on function public.world3_found(text,text,jsonb,jsonb,text) from public, anon;
revoke all on function public.world3_advance_day(text,integer,text,jsonb,jsonb,jsonb,jsonb) from public, anon;
revoke all on function public.world3_take_seat(text,text,text,integer) from public, anon;
revoke all on function public.world3_release_seat() from public, anon;

grant execute on function public.world3_found(text,text,jsonb,jsonb,text) to authenticated;
grant execute on function public.world3_advance_day(text,integer,text,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.world3_take_seat(text,text,text,integer) to authenticated;
grant execute on function public.world3_release_seat() to authenticated;
