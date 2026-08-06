-- ===========================================================================
-- World 3: APPLY THIS WHOLE FILE. Nothing to choose, nothing to skip.
--
-- Select all (Ctrl+A), copy, paste into the Supabase SQL editor, press Run.
-- Safe to run more than once: every function is create-or-replace and nothing
-- here drops, deletes or alters anything that already exists. It does not
-- touch Town Square, World 2, the phone, messages or accounts.
--
-- Expected result: "Success. No rows returned."
--
-- Then confirm with:
--   select routine_name from information_schema.routines
--   where routine_schema = 'public' and routine_name like 'world3%';
-- Expect exactly four rows.
-- ===========================================================================

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
