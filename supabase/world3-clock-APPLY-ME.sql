-- ============================================================================
-- world3-clock-APPLY-ME.sql
--
-- Apply in the Supabase SQL editor on Project Heartbeat.
--
-- WHY
-- world3_private.advance_internal refused any caller whose auth.uid() was null:
--
--     if auth.uid() is null then
--       raise exception 'Authentication required to advance the town';
--
-- That is why Ashgrove has stood at day 0 since genesis on 2026-08-06. A
-- service-role caller has no auth.uid(), so no scheduled runner could ever move
-- the town — it could only advance while a signed-in person was looking at it.
--
-- That was never a safety requirement, and it contradicts the point of the
-- world: the days are supposed to pass whether or not anybody visits.
--
-- WHAT THIS CHANGES
--   1. Adds world3_world.advanced_by  — who last moved the town.
--   2. Lets the service role advance it, recorded as 'clock'.
--   3. Keeps the signed-in path exactly as it was, recorded as 'user:<uuid>'.
--
-- Permission stops being the gate. Attribution takes its place: every advance
-- still says who did it, which is the part actually worth keeping.
--
-- Nothing is removed. The anon role still cannot advance the town.
-- ============================================================================

alter table public.world3_world
  add column if not exists advanced_by text;

comment on column public.world3_world.advanced_by is
  'Who last advanced the town: user:<uuid> for a signed-in person, or clock for the scheduled runner.';

create or replace function world3_private.advance_internal(
  p_from_digest text, p_day integer, p_digest text,
  p_records jsonb, p_log jsonb, p_sim_snapshot jsonb, p_founding jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public.world3_world%rowtype;
  v_due integer;
  v_actor text;
begin
  -- a person, or the town's own clock. anon is still refused.
  v_actor := case
    when auth.uid() is not null then 'user:' || auth.uid()::text
    when coalesce(auth.role(), current_user) in ('service_role', 'postgres') then 'clock'
    else null
  end;
  if v_actor is null then
    raise exception 'Not permitted to advance the town' using errcode = '28000';
  end if;

  select * into v from public.world3_world where id = 'main' for update;
  if not found then
    raise exception 'The town has not been founded yet' using errcode = 'P0002';
  end if;

  -- unchanged below: the digest chain, the monotonic day, and the clock ceiling
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
    advanced_by = v_actor,
    last_advanced_at = now(), updated_at = now()
  where id = 'main';

  return jsonb_build_object('status','advanced','day',p_day,'digest',p_digest,'by',v_actor);
end;
$function$;
