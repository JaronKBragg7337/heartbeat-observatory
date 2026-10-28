-- Applied to Heartbeat Supabase 2026-10-28.
create table public.ai_mailbox (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), from_ai text not null check (length(trim(from_ai)) between 1 and 100), to_ai text not null check (length(trim(to_ai)) between 1 and 100), subject text not null check (length(trim(subject)) between 1 and 200), body text not null check (length(trim(body)) between 1 and 20000), status text not null default 'new' check (status in ('new','read','done')), thread_id uuid not null default gen_random_uuid());
create index ai_mailbox_inbox_idx on public.ai_mailbox (to_ai, created_at desc);
create index ai_mailbox_thread_idx on public.ai_mailbox (thread_id, created_at);
alter table public.ai_mailbox enable row level security;
revoke all on public.ai_mailbox from anon, authenticated;
grant select, insert on public.ai_mailbox to authenticated;
grant update (status) on public.ai_mailbox to authenticated;
grant all on public.ai_mailbox to service_role;
create policy ai_mailbox_admin_select on public.ai_mailbox for select to authenticated using ((select public.is_admin()));
create policy ai_mailbox_admin_insert on public.ai_mailbox for insert to authenticated with check ((select public.is_admin()));
create policy ai_mailbox_admin_update on public.ai_mailbox for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
