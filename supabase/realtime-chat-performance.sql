-- Chat realtime + performance hardening.
-- Run in Supabase SQL editor. Safe to run multiple times.

alter table public.messages replica identity full;
alter table public.conversations replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

create index if not exists messages_conversation_created_at_asc_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists messages_conversation_created_at_desc_idx
  on public.messages (conversation_id, created_at desc);

create index if not exists messages_receiver_unread_fast_idx
  on public.messages (receiver_id, conversation_id, created_at desc)
  where read_at is null;

create index if not exists conversations_buyer_updated_idx
  on public.conversations (buyer_id, updated_at desc);

create index if not exists conversations_seller_updated_idx
  on public.conversations (seller_id, updated_at desc);

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

revoke all on function public.touch_conversation_on_message() from public;
revoke all on function public.touch_conversation_on_message() from anon, authenticated;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row
execute function public.touch_conversation_on_message();
