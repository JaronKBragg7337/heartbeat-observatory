-- Fix forward: owner chat history, narrow access discovery, public observation.
-- No account, agent, objective, queue, or credential state is changed.
drop policy if exists "qwen_messages_owner_read" on public.qwen_messages;
create policy "qwen_messages_owner_read" on public.qwen_messages
  for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists "qwen_instances_no_client_access" on public.qwen_instances;
drop policy if exists "qwen_instances_owner_identity_read" on public.qwen_instances;
create policy "qwen_instances_owner_identity_read" on public.qwen_instances
  for select to authenticated
  using (owner_user_id = (select auth.uid()));
-- Configuration remains private; this one column answers "am I the owner?"
revoke all privileges on public.qwen_instances from anon, authenticated;
grant select (id) on public.qwen_instances to authenticated;

drop policy if exists "qwen_events_owner_read" on public.qwen_events;
create policy "qwen_events_owner_read" on public.qwen_events
  for select to authenticated
  using (visibility = 'public' or owner_user_id = (select auth.uid()));
