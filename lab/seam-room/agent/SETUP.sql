-- Seam Room: only Jaron talks to the AI character (his personal Claude plan).
-- APPLIED to the live project (ygjpnvrwhkrowkrskftk) on 2026-11-01 as migration "seam_room_chat".
-- Kept here so the setup can be read or re-run on a fresh database.
create or replace function public.seam_room_owner() returns uuid
  language sql immutable as $$ select '19689e52-05ad-4809-ad67-0d8600f02216'::uuid $$;   -- Jaron's auth uid

create or replace function public.seam_room_is_owner() returns boolean
  language sql stable security definer set search_path = public
  as $$ select auth.uid() is not null and auth.uid() = public.seam_room_owner() $$;
grant execute on function public.seam_room_is_owner() to anon, authenticated;

create table if not exists public.seam_room_chat (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),      -- the human this line belongs to (always Jaron)
  speaker text not null check (speaker in ('human','ai')),
  ai_name text,                                  -- which AI said it (speaker = 'ai')
  ai_key text,                                   -- that AI's channel id, so the room puts the bubble on the right body
  place text check (place ~ '^[a-z0-9-]{1,24}$')   -- any zone id (was a,b only; broke chat from the garage and den, 11/1),
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists seam_room_chat_user_id_idx on public.seam_room_chat (user_id, id);
alter table public.seam_room_chat enable row level security;

-- Jaron can write his own lines, as a human, and only as himself.
create policy seam_room_chat_insert_own on public.seam_room_chat
  for insert to authenticated
  with check (auth.uid() = user_id and speaker = 'human' and user_id = public.seam_room_owner());
-- He reads his own conversation (his lines and the AI's replies to him). Nobody else reads anything.
create policy seam_room_chat_select_own on public.seam_room_chat
  for select to authenticated
  using (auth.uid() = user_id);
-- AI replies are written by room-agent.mjs with the service role (bypasses RLS). No anon/authenticated path can write 'ai' rows.

alter publication supabase_realtime add table public.seam_room_chat;
