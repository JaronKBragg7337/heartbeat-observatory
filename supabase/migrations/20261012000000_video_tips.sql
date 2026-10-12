-- Per-video tipping (Jaron 10/11: the website is home; most-tipped videos get shared out later).
-- Payments are OFF (system_settings.tips_enabled = 0). Rows are inserted ONLY by a future server-side webhook using the service role.
create table if not exists public.video_tips (
  id           uuid primary key default gen_random_uuid(),
  item_id      text not null,              -- tv_items.id (uuid as text), or a key like 'news:2026-09-24'
  amount_cents integer not null check (amount_cents > 0),
  provider     text not null default 'stripe',
  provider_ref text unique,                -- Stripe session / payment id; unique so a replayed webhook cannot double count
  status       text not null default 'paid' check (status in ('paid','refunded','failed')),
  created_at   timestamptz not null default now()
);
create index if not exists video_tips_item_idx on public.video_tips (item_id);
alter table public.video_tips enable row level security;
-- no policies = nobody on the public API can read or write the raw rows (service role bypasses RLS)
revoke all on public.video_tips from anon, authenticated;

-- public totals per video (no payer data exists in the table anyway)
create or replace view public.video_tip_totals as
  select item_id, sum(amount_cents)::bigint as total_cents, count(*)::bigint as tip_count, max(created_at) as last_tip_at
  from public.video_tips where status = 'paid' group by item_id;
alter view public.video_tip_totals owner to postgres;
grant select on public.video_tip_totals to anon, authenticated;

insert into public.system_settings (key, value, label, meaning, who, lives_in, kind, min, max, step, unit, sort, updated_by)
values ('tips_enabled', '0'::jsonb, 'Video tips switch (0 = off, 1 = on)',
  'While 0 the Tip button on Heartbeat TV shows "Tips open soon" and no payment flow opens. Turn to 1 only after the Stripe Payment Link is set in tv/tips.js and the webhook is live.',
  'Jaron + Claude', 'tv/tips.js, tv/index.html', 'number', 0, 1, 1, 'on/off', 900, 'claude-code')
on conflict (key) do nothing;
