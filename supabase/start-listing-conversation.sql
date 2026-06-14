-- Create or return the current user's conversation for a listing.
-- This keeps the "message seller" action atomic and avoids duplicate rows.

alter table public.conversations
  drop constraint if exists conversations_unique_listing_pair;

alter table public.conversations
  add constraint conversations_unique_listing_pair
  unique (listing_id, buyer_id, seller_id);

create or replace function public.start_listing_conversation(
  p_listing_id uuid
)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_seller_id uuid;
  v_conversation public.conversations;
begin
  if v_buyer_id is null then
    raise exception 'not authenticated'
      using errcode = '28000';
  end if;

  select seller_id
    into v_seller_id
  from public.listings
  where id = p_listing_id;

  if v_seller_id is null then
    raise exception 'listing % not found or seller missing', p_listing_id
      using errcode = 'P0002';
  end if;

  if v_seller_id = v_buyer_id then
    raise exception 'cannot start conversation with own listing'
      using errcode = '22023';
  end if;

  insert into public.conversations (
    listing_id,
    buyer_id,
    seller_id
  )
  values (
    p_listing_id,
    v_buyer_id,
    v_seller_id
  )
  on conflict (listing_id, buyer_id, seller_id)
  do update set
    updated_at = coalesce(public.conversations.updated_at, public.conversations.created_at)
  returning *
  into v_conversation;

  return v_conversation;
end;
$$;

revoke all on function public.start_listing_conversation(uuid) from public;
grant execute on function public.start_listing_conversation(uuid) to authenticated;
