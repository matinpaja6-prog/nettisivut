-- Read receipts for chat messages.
-- Run in Supabase SQL editor. Idempotent.

alter table public.messages
  add column if not exists read boolean not null default false,
  add column if not exists read_at timestamptz;

update public.messages
set read = true
where read_at is not null
  and read = false;

create index if not exists messages_receiver_unread_idx
  on public.messages (receiver_id, conversation_id, created_at)
  where read = false;

create index if not exists messages_receiver_read_at_idx
  on public.messages (receiver_id, read_at)
  where read_at is null;

alter table public.messages replica identity full;

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
end $$;

create or replace function public.enforce_message_read_receipt_update()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.listing_id is distinct from old.listing_id
    or new.sender_id is distinct from old.sender_id
    or new.receiver_id is distinct from old.receiver_id
    or new.content is distinct from old.content
    or new.image is distinct from old.image
    or new.created_at is distinct from old.created_at then
    raise exception 'only read receipt fields can be updated on messages';
  end if;

  if old.read = true and new.read = false then
    raise exception 'message read receipt cannot be unset';
  end if;

  if old.read_at is not null and new.read_at is null then
    raise exception 'message read timestamp cannot be unset';
  end if;

  if new.read_at is not null then
    new.read := true;
  end if;

  if new.read = true and new.read_at is null then
    new.read_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists messages_read_receipt_update_guard on public.messages;
create trigger messages_read_receipt_update_guard
before update on public.messages
for each row
execute function public.enforce_message_read_receipt_update();

drop policy if exists "Message receivers can mark read" on public.messages;
create policy "Message receivers can mark read"
on public.messages for update
to authenticated
using (
  auth.uid()::uuid = receiver_id::uuid
)
with check (
  auth.uid()::uuid = receiver_id::uuid
  and sender_id::uuid <> receiver_id::uuid
);
