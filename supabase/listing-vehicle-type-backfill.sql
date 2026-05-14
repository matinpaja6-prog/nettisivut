-- Fix old listings where vehicle_type was left empty/null.
-- Run in Supabase SQL editor once.

alter table public.listings
  add column if not exists vehicle_type text not null default '';

update public.listings
set vehicle_type = 'Mopo'
where coalesce(vehicle_type, '') = ''
  and (
    title ilike '%mopo%' or
    title ilike '%moped%' or
    model ilike '%bw%s%' or
    engine_cc in ('50', '65', '70', '80', '90', '125', '200')
  );

update public.listings
set vehicle_type = 'Moottorikelkka'
where coalesce(vehicle_type, '') = ''
  and (
    title ilike '%moottorikelkka%' or
    title ilike '%kelkka%' or
    title ilike '%snowmobile%'
  );

update public.listings
set vehicle_type = 'Mönkijä'
where coalesce(vehicle_type, '') = ''
  and (
    title ilike '%mönkijä%' or
    title ilike '%atv%' or
    model ilike '%outlander%' or
    model ilike '%sportsman%'
  );

update public.listings
set vehicle_type = 'Motocross'
where coalesce(vehicle_type, '') = ''
  and (
    title ilike '%motocross%' or
    model ilike '%yz%' or
    model ilike '%crf%' or
    model ilike '%sx%'
  );

create index if not exists listings_vehicle_type_idx
  on public.listings (vehicle_type);
