-- Price history table: stores key data from every published listing.
-- Used later for price suggestions / averages per part+engine combo.

create table if not exists public.price_history (
  id           uuid primary key default gen_random_uuid(),
  vehicle_type text,
  brand        text,
  model        text,
  year         text,
  engine_cc    text,
  engine_model text,
  category     text,
  subcategory  text,
  price        numeric not null,
  created_at   timestamptz not null default now()
);

-- Auto-insert a row whenever a new listing is created
create or replace function public.record_listing_price()
returns trigger language plpgsql security definer as $$
begin
  insert into public.price_history (
    vehicle_type, brand, model, year,
    engine_cc, engine_model,
    category, subcategory, price
  ) values (
    new.vehicle_type, new.brand, new.model, new.year,
    new.engine_cc, new.engine_model,
    new.category, new.subcategory, new.price::numeric
  );
  return new;
end;
$$;

drop trigger if exists on_listing_created_record_price on public.listings;
create trigger on_listing_created_record_price
  after insert on public.listings
  for each row execute function public.record_listing_price();

-- ── Sold tracking columns on listings ──────────────────────────────────────
alter table public.listings add column if not exists is_sold boolean not null default false;
alter table public.listings add column if not exists sold_price numeric;
alter table public.listings add column if not exists sold_at timestamptz;

-- Add seller_id + is_actual_sale to price_history for earnings queries
alter table public.price_history add column if not exists seller_id uuid;
alter table public.price_history add column if not exists is_actual_sale boolean not null default false;

-- RLS: only service role can write; anyone can read aggregates
alter table public.price_history enable row level security;

drop policy if exists "Price history readable by all" on public.price_history;
create policy "Price history readable by all"
  on public.price_history for select
  using (true);
