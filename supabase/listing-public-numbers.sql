-- Stable public listing IDs.
-- Existing listings get IDs by creation order starting from 1. New listings
-- continue from the largest assigned number, so deleting old listings never
-- renumbers anything later.

alter table public.listings
  add column if not exists listing_number bigint;

create sequence if not exists public.listing_number_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no cycle;

alter sequence public.listing_number_seq
  minvalue 1
  start with 1;

drop index if exists public.listings_listing_number_key;

with ordered as (
  select
    id,
    row_number() over (order by created_at asc, id asc) as next_number
  from public.listings
)
update public.listings l
set listing_number = ordered.next_number
from ordered
where l.id = ordered.id;

with sequence_state as (
  select max(listing_number) as max_listing_number
  from public.listings
)
select setval(
  'public.listing_number_seq',
  greatest(1, coalesce(max_listing_number, 1)),
  max_listing_number is not null
)
from sequence_state;

alter table public.listings
  alter column listing_number set default nextval('public.listing_number_seq'),
  alter column listing_number set not null;

create unique index if not exists listings_listing_number_key
  on public.listings(listing_number);
