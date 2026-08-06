-- ===========================================================================
-- World 3: shared furniture edits. APPLY THIS WHOLE FILE.
--
-- Select all (Ctrl+A), copy, paste into the Supabase SQL editor, press Run.
-- Safe to run more than once: create-or-replace throughout, nothing is dropped
-- or deleted, and it touches nothing that Town Square, World 2, the phone,
-- messages or accounts use.
--
-- Expected result: "Success. No rows returned."
--
-- Then confirm with:
--   select routine_name from information_schema.routines
--   where routine_schema = 'public' and routine_name like 'world3_move%';
-- Expect one row: world3_move_asset.
-- ===========================================================================
--
-- WHAT THIS IS FOR
-- Ashgrove furnishes itself, and it sometimes parks a cabinet across a doorway
-- or a couch too big for its room. Rather than one person hunting every case,
-- anyone can move a piece and it stays moved for everybody. The same mechanism
-- later lets people furnish their own homes.
--
-- WHY IT STORES DELTAS AND NOT POSITIONS
-- Every item has a permanent asset id (B22-L0-R03-F02) and a home position the
-- generator computes. A row here is the OFFSET FROM HOME, never a coordinate.
-- That is what lets the town be regenerated, regrown or reseeded underneath
-- these edits without any of them landing in a wall.

create table if not exists public.world3_edits (
  asset_id   text primary key
    check (asset_id ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and char_length(asset_id) between 3 and 64),
  dx         real not null default 0 check (dx between -30 and 30),
  dz         real not null default 0 check (dz between -30 and 30),
  dr         real not null default 0 check (dr between -100 and 100),
  hidden     boolean not null default false,
  moved_by   uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.world3_edits is
  'Furniture moved by players in World 3, stored as an offset from the item''s generated home position so the town can be rebuilt underneath it.';

create index if not exists world3_edits_updated_idx
  on public.world3_edits (updated_at desc);

alter table public.world3_edits enable row level security;

-- Everyone sees the same furniture, signed in or not.
drop policy if exists "Edits are readable by everyone" on public.world3_edits;
create policy "Edits are readable by everyone"
on public.world3_edits for select
to anon, authenticated
using (true);

-- No write policy. The function below is the only way in.
grant select on public.world3_edits to anon, authenticated;

create schema if not exists world3_private;
revoke all on schema world3_private from public, anon, authenticated;

-- Move one piece of furniture.
--
-- The clamps are the point: dx/dz are bounded by the column checks, so nobody
-- can fling a sofa across the town or park it inside the terrain. An edit that
-- returns an item to within a millimetre of its home DELETES the row rather
-- than storing a no-op, so the table stays the size of the changes rather than
-- the size of the town.
create or replace function world3_private.move_asset_internal(
  p_asset_id text, p_dx real, p_dz real, p_dr real, p_hidden boolean
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to rearrange the town' using errcode = '28000';
  end if;

  if abs(coalesce(p_dx,0)) < 0.001 and abs(coalesce(p_dz,0)) < 0.001
     and abs(coalesce(p_dr,0)) < 0.001 and not coalesce(p_hidden,false) then
    delete from public.world3_edits where asset_id = p_asset_id;
    return jsonb_build_object('status','reset','asset',p_asset_id);
  end if;

  insert into public.world3_edits (asset_id, dx, dz, dr, hidden, moved_by, updated_at)
  values (p_asset_id, coalesce(p_dx,0), coalesce(p_dz,0), coalesce(p_dr,0),
          coalesce(p_hidden,false), v_uid, now())
  on conflict (asset_id) do update
    set dx = excluded.dx, dz = excluded.dz, dr = excluded.dr,
        hidden = excluded.hidden, moved_by = excluded.moved_by, updated_at = now();

  return jsonb_build_object('status','moved','asset',p_asset_id);
end;
$fn$;

create or replace function public.world3_move_asset(
  p_asset_id text, p_dx real default 0, p_dz real default 0,
  p_dr real default 0, p_hidden boolean default false
) returns jsonb language sql security invoker set search_path = '' as $fn$
  select world3_private.move_asset_internal(p_asset_id, p_dx, p_dz, p_dr, p_hidden);
$fn$;

grant usage on schema world3_private to authenticated;
grant execute on function world3_private.move_asset_internal(text,real,real,real,boolean) to authenticated;

revoke all on function public.world3_move_asset(text,real,real,real,boolean) from public, anon;
grant execute on function public.world3_move_asset(text,real,real,real,boolean) to authenticated;
