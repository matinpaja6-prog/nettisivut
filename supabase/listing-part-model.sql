-- Add optional exact part model/manufacturer for listings.
-- Examples: Stage6, Airsal, Malossi.
-- Run this in Supabase SQL editor so part models persist and can be searched.

alter table public.listings
  add column if not exists part_model text;

alter table public.sold_listings
  add column if not exists part_model text;

create index if not exists listings_part_model_idx
  on public.listings (part_model);

create index if not exists sold_listings_part_model_idx
  on public.sold_listings (part_model);
