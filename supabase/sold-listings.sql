create table if not exists public.sold_listings (
  id uuid default gen_random_uuid() not null,
  listing_id uuid,
  seller_id uuid not null,
  buyer_id uuid,
  title text,
  price numeric,
  sold_price numeric not null default 0,
  vehicle_type text,
  brand text,
  model text,
  year text,
  category text,
  subcategory text,
  image_url text,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (id)
);

alter table if exists public.sold_listings
  drop constraint if exists sold_listings_listing_id_key;
create unique index if not exists sold_listings_listing_id_key
  on public.sold_listings (listing_id);

alter table public.sold_listings alter column title drop not null;

create index if not exists sold_listings_seller_sold_at_idx
  on public.sold_listings (seller_id, sold_at desc);

alter table public.sold_listings enable row level security;

drop policy if exists "Sellers can read own sold listings" on public.sold_listings;
create policy "Sellers can read own sold listings"
  on public.sold_listings for select
  using (auth.uid() = seller_id);

drop policy if exists "Admins can read sold listings" on public.sold_listings;
create policy "Admins can read sold listings"
  on public.sold_listings for select
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "Sellers can insert own sold listings" on public.sold_listings;
create policy "Sellers can insert own sold listings"
  on public.sold_listings for insert
  with check (auth.uid() = seller_id);

drop policy if exists "Sellers can update own sold listings" on public.sold_listings;
create policy "Sellers can update own sold listings"
  on public.sold_listings for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "Sellers can delete own sold listings" on public.sold_listings;
create policy "Sellers can delete own sold listings"
  on public.sold_listings for delete
  using (auth.uid() = seller_id);
