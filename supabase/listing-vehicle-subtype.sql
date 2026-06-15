alter table public.listings
  add column if not exists vehicle_subtype text not null default '';

alter table public.sold_listings
  add column if not exists vehicle_subtype text;
