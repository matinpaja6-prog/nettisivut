-- Keep exactly one conversation per listing, buyer and seller.
-- Run this once if an older database has duplicate conversation rows.

with ranked as (
  select
    id,
    first_value(id) over (
      partition by listing_id, buyer_id, seller_id
      order by coalesce(updated_at, created_at) desc, created_at desc, id
    ) as keep_id,
    row_number() over (
      partition by listing_id, buyer_id, seller_id
      order by coalesce(updated_at, created_at) desc, created_at desc, id
    ) as rn
  from public.conversations
),
duplicates as (
  select id, keep_id
  from ranked
  where rn > 1
)
update public.messages m
set conversation_id = d.keep_id
from duplicates d
where m.conversation_id = d.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by listing_id, buyer_id, seller_id
      order by coalesce(updated_at, created_at) desc, created_at desc, id
    ) as rn
  from public.conversations
)
delete from public.conversations c
using ranked r
where c.id = r.id
  and r.rn > 1;

alter table public.conversations
  drop constraint if exists conversations_unique_listing_pair;

alter table public.conversations
  add constraint conversations_unique_listing_pair
  unique (listing_id, buyer_id, seller_id);

create index if not exists conversations_listing_buyer_seller_idx
  on public.conversations (listing_id, buyer_id, seller_id);

create or replace function public.enforce_message_conversation_scope()
returns trigger
language plpgsql
as $$
declare
  v_listing_id uuid;
  v_buyer_id uuid;
  v_seller_id uuid;
begin
  select listing_id, buyer_id, seller_id
    into v_listing_id, v_buyer_id, v_seller_id
  from public.conversations
  where id = new.conversation_id;

  if v_listing_id is null then
    raise exception 'conversation % not found', new.conversation_id;
  end if;

  new.listing_id := v_listing_id;

  if new.sender_id not in (v_buyer_id, v_seller_id) then
    raise exception 'sender is not a conversation participant';
  end if;

  if new.receiver_id not in (v_buyer_id, v_seller_id) or new.receiver_id = new.sender_id then
    new.receiver_id := case
      when new.sender_id = v_buyer_id then v_seller_id
      else v_buyer_id
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_enforce_conversation_scope on public.messages;

create trigger messages_enforce_conversation_scope
before insert or update of conversation_id, listing_id, sender_id, receiver_id
on public.messages
for each row
execute function public.enforce_message_conversation_scope();
