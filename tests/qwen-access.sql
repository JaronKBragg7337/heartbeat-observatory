-- Read-only/rolled-back role checks. Run as the database administrator.
-- No owner ID or session credential is stored in this source file.
begin;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select owner_user_id from public.qwen_instances where id='polymarket-qwen'),
  'role', 'authenticated'
)::text, true);
set local role authenticated;
select 'owner' as scenario,
  exists(select id from public.qwen_instances where id='polymarket-qwen') as owner_instance_visible,
  (select count(*) from public.qwen_messages where qwen_id='polymarket-qwen') as readable_messages,
  not has_column_privilege(current_user,'public.qwen_instances','session_key','SELECT') as config_private,
  not has_table_privilege(current_user,'public.qwen_messages','INSERT') as direct_insert_blocked,
  not has_table_privilege(current_user,'public.qwen_messages','UPDATE') as direct_update_blocked,
  not has_table_privilege(current_user,'public.qwen_messages','DELETE') as direct_delete_blocked;

reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000000","role":"authenticated"}',true);
set local role authenticated;
select 'non-owner' as scenario,
  not exists(select id from public.qwen_instances) as owner_instance_hidden,
  not exists(select 1 from public.qwen_messages) as messages_private,
  exists(select 1 from public.qwen_events where visibility='public') as public_events_visible,
  not exists(select 1 from public.qwen_events where visibility='owner') as private_events_hidden,
  public.qwen_enqueue_message('polymarket-qwen','Permission test — must not be delivered') as rejected_enqueue;

reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select 'guest' as scenario,
  exists(select 1 from public.qwen_state) as dashboard_visible,
  not exists(select 1 from public.qwen_events where visibility='owner') as private_events_hidden,
  not has_table_privilege(current_user,'public.qwen_messages','SELECT') as messages_private,
  not has_function_privilege(current_user,'public.qwen_enqueue_message(text,text)','EXECUTE') as control_blocked;
rollback;
