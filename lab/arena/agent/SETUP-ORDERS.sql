-- The Arena, team mode: Jaron's orders to his AI teammate (arena_orders).
-- NOT APPLIED YET. The main session applies it to the live project (ygjpnvrwhkrowkrskftk), e.g. as migration "arena_orders".
-- The same pattern as lab/seam-room/agent/SETUP.sql (seam_room_chat):
--   * only Jaron (auth uid below, account acsassociation7337) can insert an order, as a human, as himself;
--   * only Jaron can read the table (his orders and the AI's short status replies);
--   * the AI teammate (arena-agent.mjs follow-orders / wait-order / reply) reads and answers with the service role,
--     which bypasses RLS. No anon or authenticated path can write an 'ai' row, update, or delete.
-- Re-runnable. Tested on PostgreSQL 16 with a stand-in auth schema: lab/arena/test/orders_rls.sh.

create or replace function public.arena_owner() returns uuid
  language sql immutable as $$ select '19689e52-05ad-4809-ad67-0d8600f02216'::uuid $$;   -- Jaron's auth uid (= seam_room_owner())

create or replace function public.arena_is_owner() returns boolean
  language sql stable security definer set search_path = public
  as $$ select auth.uid() is not null and auth.uid() = public.arena_owner() $$;
grant execute on function public.arena_is_owner() to anon, authenticated;

create table if not exists public.arena_orders (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),       -- always Jaron
  speaker text not null check (speaker in ('human','ai')),
  kind text not null check (kind in ('follow','hold','goto','cover','flank-left','flank-right','find','say','status')),
  x real check (x between -20 and 20),            -- 'goto': the tapped spot on the field (metres)
  z real check (z between -12 and 12),
  body text not null default '' check (char_length(body) <= 280),   -- free text order ('say'), or the AI's status
  team text check (team in ('a','b')),            -- the team Jaron is on when he sends it (the page he loaded)
  to_name text check (char_length(to_name) <= 24),  -- optional: which AI teammate (null = any on his team)
  ai_name text,                                   -- speaker 'ai': which AI answered
  ai_key text,                                    -- that AI's channel id, so the page puts the bubble on the right body
  reply_to bigint,                                -- the order this status answers
  created_at timestamptz not null default now(),
  constraint arena_orders_goto_has_spot check (kind <> 'goto' or (x is not null and z is not null)),
  constraint arena_orders_human_kinds check (speaker <> 'human' or kind <> 'status')
);
create index if not exists arena_orders_user_id_idx on public.arena_orders (user_id, id);
alter table public.arena_orders enable row level security;

-- Jaron writes his own orders, as a human, only as himself. (No 'ai' rows, no AI fields.)
drop policy if exists arena_orders_insert_owner on public.arena_orders;
create policy arena_orders_insert_owner on public.arena_orders
  for insert to authenticated
  with check (auth.uid() = user_id and user_id = public.arena_owner() and speaker = 'human'
              and ai_name is null and ai_key is null and reply_to is null);
-- Only Jaron reads (his orders + the AI's replies). Nobody else reads anything.
drop policy if exists arena_orders_select_owner on public.arena_orders;
create policy arena_orders_select_owner on public.arena_orders
  for select to authenticated
  using (auth.uid() = user_id and user_id = public.arena_owner());
-- No update or delete policy: nobody but the service role can change or remove a row.
revoke all on public.arena_orders from anon;
revoke update, delete, truncate on public.arena_orders from authenticated;

-- the page hears the AI's replies live (postgres_changes; realtime applies the select policy, so only Jaron gets them)
do $$ begin
  alter publication supabase_realtime add table public.arena_orders;
exception when duplicate_object then null; end $$;
