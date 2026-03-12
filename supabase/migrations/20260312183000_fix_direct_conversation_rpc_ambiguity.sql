begin;

create or replace function public.get_or_create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  resolved_conversation_id uuid;
  direct_conversation_key text;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = actor_id then
    raise exception 'A different recipient is required';
  end if;

  if not public.is_connection_accepted(actor_id, target_user_id) then
    raise exception 'Connect before starting a direct chat';
  end if;

  direct_conversation_key := public.make_direct_conversation_key(actor_id, target_user_id);

  insert into public.conversations (kind, created_by, direct_key, metadata)
  values ('direct', actor_id, direct_conversation_key, jsonb_build_object('participant_count', 2))
  on conflict (direct_key) do update
    set updated_at = timezone('utc', now())
  returning id into resolved_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (resolved_conversation_id, actor_id),
    (resolved_conversation_id, target_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return resolved_conversation_id;
end;
$$;

grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

commit;
