-- Stable public listing IDs.
-- Existing listings get IDs by creation order. New listings continue from the
-- largest assigned number, so deleting old listings never renumbers anything.

alter table public.listings
  add column if not exists listing_number bigint;

create sequence if not exists public.listing_number_seq
  as bigint
  start with 100001
  increment by 1
  minvalue 100001
  no cycle;

with ordered as (
  select
    id,
    100000 + row_number() over (order by created_at asc, id asc) as next_number
  from public.listings
  where listing_number is null
)
update public.listings l
set listing_number = ordered.next_number
from ordered
where l.id = ordered.id;

select setval(
  'public.listing_number_seq',
  greatest(
    100000,
    coalesce((select max(listing_number) from public.listings), 100000)
  ),
  true
);

alter table public.listings
  alter column listing_number set default nextval('public.listing_number_seq'),
  alter column listing_number set not null;

create unique index if not exists listings_listing_number_key
  on public.listings(listing_number);
