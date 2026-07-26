-- Keep listing conversations open for messaging for 20 days after the listing
-- is deleted, then remove the conversation and its messages automatically.
-- Run this once in the Supabase SQL editor.

alter table public.conversations
  add column if not exists listing_deleted_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists listing_title text,
  add column if not exists listing_image_url text,
  add column if not exists listing_price numeric,
  add column if not exists listing_seller_name text,
  add column if not exists listing_number bigint;

-- Keep the original listing id in the conversation and messages after the
-- listing row is gone. The delete trigger below owns the retention lifecycle.
alter table public.messages
  drop constraint if exists messages_listing_id_fkey;

alter table public.conversations
  drop constraint if exists conversations_listing_id_fkey;

alter table public.messages
  drop constraint if exists messages_conversation_id_fkey;

alter table public.messages
  add constraint messages_conversation_id_fkey
  foreign key (conversation_id)
  references public.conversations (id)
  on delete cascade;

create index if not exists conversations_expires_at_idx
  on public.conversations (expires_at)
  where expires_at is not null;

create or replace function public.retain_conversations_for_deleted_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    listing_deleted_at = now(),
    expires_at = now() + interval '20 days',
    listing_title = coalesce(listing_title, old.title),
    listing_image_url = coalesce(listing_image_url, old.image_url),
    listing_price = coalesce(
      listing_price,
      nullif(
        regexp_replace(
          replace(coalesce(to_jsonb(old) ->> 'price', ''), ',', '.'),
          '[^0-9.-]',
          '',
          'g'
        ),
        ''
      )::numeric
    ),
    listing_seller_name = coalesce(listing_seller_name, old.seller_name),
    listing_number = coalesce(
      listing_number,
      nullif(to_jsonb(old) ->> 'listing_number', '')::bigint
    )
  where listing_id = old.id;

  return old;
end;
$$;

drop trigger if exists listings_retain_conversations_before_delete
  on public.listings;

create trigger listings_retain_conversations_before_delete
before delete on public.listings
for each row
execute function public.retain_conversations_for_deleted_listing();

create or replace function public.purge_expired_listing_conversations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.conversations
  where expires_at is not null
    and expires_at <= now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_listing_conversations() from public;

-- The trigger owns conversation ordering, so clients do not need broad update
-- access that could otherwise be used to change the retention deadline.
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

drop policy if exists "Conversation participants can update"
  on public.conversations;
revoke update on table public.conversations from public, anon, authenticated;

-- Both participants may keep messaging until the fixed retention deadline.
drop policy if exists "Active listing required for new messages"
  on public.messages;
drop policy if exists "Unexpired conversation required for new messages"
  on public.messages;

create policy "Unexpired conversation required for new messages"
on public.messages
as restrictive
for insert
to authenticated
with check (
  auth.uid()::uuid = sender_id::uuid
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.expires_at is null or c.expires_at > now())
      and (
        auth.uid()::uuid = c.buyer_id::uuid
        or auth.uid()::uuid = c.seller_id::uuid
      )
  )
);

-- Bring conversations from listings deleted before this migration under the
-- same retention rule. Their snapshot fields remain available when they were
-- already captured by the delete trigger.
update public.conversations c
set
  listing_deleted_at = null,
  expires_at = null
where exists (
  select 1
  from public.listings l
  where l.id = c.listing_id
);

update public.conversations c
set
  listing_deleted_at = coalesce(c.listing_deleted_at, now()),
  expires_at = coalesce(c.expires_at, now() + interval '20 days')
where c.listing_deleted_at is null
  and not exists (
    select 1
    from public.listings l
    where l.id = c.listing_id
  );

update public.conversations
set expires_at = listing_deleted_at + interval '20 days'
where listing_deleted_at is not null;

-- Expired conversations also become unreadable immediately, even if the
-- scheduled physical cleanup has not run yet.
drop policy if exists "Conversation participants can read" on public.conversations;
create policy "Conversation participants can read"
on public.conversations for select
to authenticated
using (
  (auth.uid()::uuid = buyer_id::uuid or auth.uid()::uuid = seller_id::uuid)
  and (expires_at is null or expires_at > now())
);

drop policy if exists "Message participants can read" on public.messages;
create policy "Message participants can read"
on public.messages for select
to authenticated
using (
  (auth.uid()::uuid = sender_id::uuid or auth.uid()::uuid = receiver_id::uuid)
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.expires_at is null or c.expires_at > now())
  )
);

-- Supabase supports pg_cron. This removes the retained rows (and, through the
-- conversation FK, their messages) within an hour after the deadline.
create extension if not exists pg_cron;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'purge-expired-listing-conversations'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'purge-expired-listing-conversations',
    '17 * * * *',
    'select public.purge_expired_listing_conversations();'
  );
end;
$$;
