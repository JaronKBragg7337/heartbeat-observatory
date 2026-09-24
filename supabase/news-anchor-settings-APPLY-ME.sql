-- Heartbeat News: shared anchor settings (voice + look) for AI Robot Vex and Alien Joe.
-- Written 2026-09-24 by Claude (cloud). Copy also in AI-Shared/projects/news-show/2026-09-24-news-anchor-settings.sql.
-- Safe to run more than once.
--
-- Everyone reads the settings (so every viewer hears the same voices); only accounts is_admin() says true for can write.
-- Until this runs, the page plays the built-in defaults and the Voice Studio says "not saved: table isn't in the database yet".

create table if not exists public.news_anchor_settings (
  anchor      text primary key check (anchor in ('vex', 'joe')),
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

alter table public.news_anchor_settings enable row level security;

drop policy if exists "news settings are public" on public.news_anchor_settings;
create policy "news settings are public" on public.news_anchor_settings
  for select to anon, authenticated using (true);

drop policy if exists "admins insert news settings" on public.news_anchor_settings;
create policy "admins insert news settings" on public.news_anchor_settings
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins update news settings" on public.news_anchor_settings;
create policy "admins update news settings" on public.news_anchor_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete news settings" on public.news_anchor_settings;
create policy "admins delete news settings" on public.news_anchor_settings
  for delete to authenticated using (public.is_admin());

grant select on public.news_anchor_settings to anon, authenticated;
grant insert, update, delete on public.news_anchor_settings to authenticated;

-- Start empty on purpose: no row = the page's defaults (news/voices.js DEFAULT_SETTINGS). The first admin Save writes both rows.

-- The home page directory: a row so the database-driven list shows the News entry with the others.
-- (The page also adds it itself when the row is missing, so this is tidy-up, not required.)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'surfaces') then
    if not exists (select 1 from public.surfaces where key = 'news') then
      begin
        insert into public.surfaces (key, name, status, position) values ('news', 'Heartbeat News', 'live', 0);
      exception when others then
        raise notice 'surfaces row for news not added (%); the home page adds the entry itself', sqlerrm;
      end;
    end if;
  end if;
end $$;
