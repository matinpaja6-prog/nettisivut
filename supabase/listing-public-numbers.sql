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

update public.listings
set listing_number = listing_number - 100000
where listing_number >= 100001;

with numbered_existing as (
  select coalesce(max(listing_number), 0) as max_listing_number
  from public.listings
),
missing_numbers as (
  select
    l.id,
    numbered_existing.max_listing_number +
      row_number() over (order by l.created_at asc, l.id asc) as next_number
  from public.listings l
  cross join numbered_existing
  where l.listing_number is null
)
update public.listings l
set listing_number = missing_numbers.next_number
from missing_numbers
where l.id = missing_numbers.id;

with sequence_state as (
  select greatest(
    coalesce((select max(listing_number) from public.listings), 0),
    case
      when to_regclass('public.listing_number_seq') is null then 0
      else (select last_value from public.listing_number_seq)
    end
  ) as max_listing_number
)
select setval(
  'public.listing_number_seq',
  greatest(1, coalesce(max_listing_number, 1)),
  max_listing_number > 0
)
from sequence_state;

alter table public.listings
  alter column listing_number set default nextval('public.listing_number_seq'),
  alter column listing_number set not null;

create unique index if not exists listings_listing_number_key
  on public.listings(listing_number);
