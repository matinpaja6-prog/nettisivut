-- Add optional part/OEM number for listings.
-- Run this in Supabase SQL editor so part numbers persist and can be searched.

alter table public.listings
  add column if not exists part_number text;

create index if not exists listings_part_number_idx
  on public.listings (part_number);
