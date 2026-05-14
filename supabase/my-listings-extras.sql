-- ============================================================
-- /my-listings extras: hidden flag + message counts
-- Run this in Supabase SQL editor (idempotent).
-- ============================================================

-- 1. Add is_hidden flag to listings ---------------------------
alter table public.listings
  add column if not exists is_hidden boolean not null default false;

create index if not exists listings_is_hidden_idx
  on public.listings (seller_id, is_hidden);

-- Hide listings from the public when is_hidden = true.
-- Existing public read policy stays, but we add a stricter view filter
-- through a policy that only owners (or admins) can see hidden ones.
drop policy if exists "Public can read listings" on public.listings;
create policy "Public can read listings"
  on public.listings
  for select
  using (
    coalesce(is_hidden, false) = false
    or auth.uid() = seller_id
  );

-- 2. Per-listing message count -------------------------------
-- Ensure messages has a read_at column for unread tracking.
alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists messages_unread_idx
  on public.messages (receiver_id, read_at)
  where read_at is null;

-- View: how many conversations + total messages each listing has,
-- restricted by RLS so each seller only sees their own listings.
create or replace view public.listing_message_counts as
select
  l.id                                   as listing_id,
  l.seller_id                            as seller_id,
  count(distinct c.id)                   as conversation_count,
  coalesce(count(m.id), 0)               as message_count,
  coalesce(
    count(m.id) filter (
      where m.receiver_id = l.seller_id and m.read_at is null
    ),
    0
  )                                      as unread_count
from public.listings l
left join public.conversations c on c.listing_id = l.id
left join public.messages      m on m.conversation_id = c.id
group by l.id, l.seller_id;

grant select on public.listing_message_counts to authenticated;

-- RPC variant returning counts for the calling user's listings only.
create or replace function public.get_my_listing_message_counts()
returns table (
  listing_id uuid,
  conversation_count bigint,
  message_count bigint,
  unread_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    listing_id,
    conversation_count,
    message_count,
    unread_count
  from public.listing_message_counts
  where seller_id = auth.uid();
$$;

grant execute on function public.get_my_listing_message_counts() to authenticated;

-- 3. Toggle hide helper --------------------------------------
create or replace function public.set_listing_hidden(
  p_listing_id uuid,
  p_hidden boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select seller_id into v_owner
  from public.listings
  where id = p_listing_id;

  if v_owner is null then
    raise exception 'Ilmoitusta ei löydy';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'Vain ilmoituksen omistaja voi muuttaa näkyvyyttä';
  end if;

  update public.listings
  set is_hidden = p_hidden
  where id = p_listing_id;

  return p_hidden;
end;
$$;

grant execute on function public.set_listing_hidden(uuid, boolean) to authenticated;
