-- Price history / part market data.
-- Stores structured data from published listings and completed sales so the
-- app can later suggest prices and analyze demand by part, vehicle and engine.

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid,
  sold_listing_id uuid,
  seller_id uuid,
  buyer_id uuid,
  title text,
  listing_mode text,
  vehicle_type text,
  brand text,
  model text,
  year text,
  engine_cc text,
  engine_model text,
  category text,
  subcategory text,
  part_number text,
  condition text,
  location text,
  price numeric not null,
  asking_price numeric,
  sold_price numeric,
  source text not null default 'listing_created',
  is_actual_sale boolean not null default false,
  sold_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.price_history add column if not exists listing_id uuid;
alter table public.price_history add column if not exists sold_listing_id uuid;
alter table public.price_history add column if not exists seller_id uuid;
alter table public.price_history add column if not exists buyer_id uuid;
alter table public.price_history add column if not exists title text;
alter table public.price_history add column if not exists listing_mode text;
alter table public.price_history add column if not exists part_number text;
alter table public.price_history add column if not exists condition text;
alter table public.price_history add column if not exists location text;
alter table public.price_history add column if not exists asking_price numeric;
alter table public.price_history add column if not exists sold_price numeric;
alter table public.price_history add column if not exists source text not null default 'listing_created';
alter table public.price_history add column if not exists is_actual_sale boolean not null default false;
alter table public.price_history add column if not exists sold_at timestamptz;
alter table public.price_history add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.listings add column if not exists is_sold boolean not null default false;
alter table public.listings add column if not exists sold_price numeric;
alter table public.listings add column if not exists sold_at timestamptz;

alter table if exists public.sold_listings add column if not exists engine_cc text;
alter table if exists public.sold_listings add column if not exists engine_model text;
alter table if exists public.sold_listings add column if not exists part_number text;
alter table if exists public.sold_listings add column if not exists condition text;
alter table if exists public.sold_listings add column if not exists location text;

create index if not exists price_history_part_lookup_idx
  on public.price_history (category, subcategory, engine_model, engine_cc, year);

create index if not exists price_history_actual_sale_idx
  on public.price_history (is_actual_sale, category, subcategory, engine_model, engine_cc, sold_at desc);

create index if not exists price_history_part_number_idx
  on public.price_history (part_number)
  where part_number is not null and part_number <> '';

create unique index if not exists price_history_listing_source_uidx
  on public.price_history (listing_id, source)
  where listing_id is not null;

create unique index if not exists price_history_sold_listing_source_uidx
  on public.price_history (sold_listing_id, source)
  where sold_listing_id is not null;

create or replace function public.record_listing_price()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.price_history (
    listing_id,
    seller_id,
    title,
    listing_mode,
    vehicle_type,
    brand,
    model,
    year,
    engine_cc,
    engine_model,
    category,
    subcategory,
    part_number,
    condition,
    location,
    price,
    asking_price,
    source,
    is_actual_sale,
    created_at
  ) values (
    new.id,
    new.seller_id,
    new.title,
    new.listing_mode,
    new.vehicle_type,
    new.brand,
    new.model,
    new.year,
    new.engine_cc,
    new.engine_model,
    new.category,
    new.subcategory,
    new.part_number,
    new.condition,
    new.location,
    new.price::numeric,
    new.price::numeric,
    'listing_created',
    false,
    coalesce(new.created_at, now())
  );

  return new;
end;
$$;

drop trigger if exists on_listing_created_record_price on public.listings;
create trigger on_listing_created_record_price
  after insert on public.listings
  for each row execute function public.record_listing_price();

create or replace function public.record_listing_sold_price()
returns trigger
language plpgsql
security definer
as $$
begin
  if coalesce(new.is_sold, false) is true
     and (
       coalesce(old.is_sold, false) is false
       or coalesce(old.sold_price, -1) is distinct from coalesce(new.sold_price, -1)
     ) then
    insert into public.price_history (
      listing_id,
      seller_id,
      title,
      listing_mode,
      vehicle_type,
      brand,
      model,
      year,
      engine_cc,
      engine_model,
      category,
      subcategory,
      part_number,
      condition,
      location,
      price,
      asking_price,
      sold_price,
      source,
      is_actual_sale,
      sold_at,
      created_at
    ) values (
      new.id,
      new.seller_id,
      new.title,
      new.listing_mode,
      new.vehicle_type,
      new.brand,
      new.model,
      new.year,
      new.engine_cc,
      new.engine_model,
      new.category,
      new.subcategory,
      new.part_number,
      new.condition,
      new.location,
      coalesce(new.sold_price, new.price)::numeric,
      new.price::numeric,
      coalesce(new.sold_price, new.price)::numeric,
      'listing_sold',
      true,
      coalesce(new.sold_at, now()),
      now()
    )
    on conflict (listing_id, source) where listing_id is not null
    do update set
      price = excluded.price,
      asking_price = excluded.asking_price,
      sold_price = excluded.sold_price,
      sold_at = excluded.sold_at,
      is_actual_sale = true,
      metadata = price_history.metadata || jsonb_build_object('updated_at', now());
  end if;

  return new;
end;
$$;

drop trigger if exists on_listing_sold_record_price on public.listings;
create trigger on_listing_sold_record_price
  after update of is_sold, sold_price, sold_at on public.listings
  for each row execute function public.record_listing_sold_price();

create or replace function public.record_sold_listing_price()
returns trigger
language plpgsql
security definer
as $$
declare
  listing_snapshot public.listings%rowtype;
begin
  if new.listing_id is not null then
    select *
      into listing_snapshot
      from public.listings
      where id = new.listing_id
      limit 1;
  end if;

  insert into public.price_history (
    listing_id,
    sold_listing_id,
    seller_id,
    buyer_id,
    title,
    listing_mode,
    vehicle_type,
    brand,
    model,
    year,
    engine_cc,
    engine_model,
    category,
    subcategory,
    part_number,
    condition,
    location,
    price,
    asking_price,
    sold_price,
    source,
    is_actual_sale,
    sold_at,
    created_at
  ) values (
    new.listing_id,
    new.id,
    new.seller_id,
    new.buyer_id,
    coalesce(new.title, listing_snapshot.title),
    coalesce(new.listing_mode, listing_snapshot.listing_mode),
    coalesce(new.vehicle_type, listing_snapshot.vehicle_type),
    coalesce(new.brand, listing_snapshot.brand),
    coalesce(new.model, listing_snapshot.model),
    coalesce(new.year, listing_snapshot.year),
    coalesce(new.engine_cc, listing_snapshot.engine_cc),
    coalesce(new.engine_model, listing_snapshot.engine_model),
    coalesce(new.category, listing_snapshot.category),
    coalesce(new.subcategory, listing_snapshot.subcategory),
    coalesce(new.part_number, listing_snapshot.part_number),
    coalesce(new.condition, listing_snapshot.condition),
    coalesce(new.location, listing_snapshot.location),
    coalesce(new.sold_price, new.price, listing_snapshot.price)::numeric,
    coalesce(new.price, listing_snapshot.price)::numeric,
    coalesce(new.sold_price, new.price, listing_snapshot.price)::numeric,
    'sold_listing',
    true,
    coalesce(new.sold_at, now()),
    now()
  )
  on conflict (sold_listing_id, source) where sold_listing_id is not null
  do update set
    price = excluded.price,
    asking_price = excluded.asking_price,
    sold_price = excluded.sold_price,
    buyer_id = excluded.buyer_id,
    sold_at = excluded.sold_at,
    is_actual_sale = true,
    metadata = price_history.metadata || jsonb_build_object('updated_at', now());

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.sold_listings') is not null then
    drop trigger if exists on_sold_listing_record_price on public.sold_listings;
    create trigger on_sold_listing_record_price
      after insert or update on public.sold_listings
      for each row execute function public.record_sold_listing_price();
  end if;
end;
$$;

insert into public.price_history (
  listing_id,
  seller_id,
  title,
  listing_mode,
  vehicle_type,
  brand,
  model,
  year,
  engine_cc,
  engine_model,
  category,
  subcategory,
  part_number,
  condition,
  location,
  price,
  asking_price,
  source,
  is_actual_sale,
  created_at
)
select
  l.id,
  l.seller_id,
  l.title,
  l.listing_mode,
  l.vehicle_type,
  l.brand,
  l.model,
  l.year,
  l.engine_cc,
  l.engine_model,
  l.category,
  l.subcategory,
  l.part_number,
  l.condition,
  l.location,
  l.price::numeric,
  l.price::numeric,
  'listing_created',
  false,
  coalesce(l.created_at, now())
from public.listings l
where coalesce(l.price, 0) > 0
on conflict (listing_id, source) where listing_id is not null
do nothing;

do $$
begin
  if to_regclass('public.sold_listings') is not null then
    execute $backfill$
      insert into public.price_history (
        listing_id,
        sold_listing_id,
        seller_id,
        buyer_id,
        title,
        listing_mode,
        vehicle_type,
        brand,
        model,
        year,
        engine_cc,
        engine_model,
        category,
        subcategory,
        part_number,
        condition,
        location,
        price,
        asking_price,
        sold_price,
        source,
        is_actual_sale,
        sold_at,
        created_at
      )
      select
        s.listing_id,
        s.id,
        s.seller_id,
        s.buyer_id,
        coalesce(s.title, l.title),
        coalesce(s.listing_mode, l.listing_mode),
        coalesce(s.vehicle_type, l.vehicle_type),
        coalesce(s.brand, l.brand),
        coalesce(s.model, l.model),
        coalesce(s.year, l.year),
        coalesce(s.engine_cc, l.engine_cc),
        coalesce(s.engine_model, l.engine_model),
        coalesce(s.category, l.category),
        coalesce(s.subcategory, l.subcategory),
        coalesce(s.part_number, l.part_number),
        coalesce(s.condition, l.condition),
        coalesce(s.location, l.location),
        coalesce(s.sold_price, s.price, l.price)::numeric,
        coalesce(s.price, l.price)::numeric,
        coalesce(s.sold_price, s.price, l.price)::numeric,
        'sold_listing',
        true,
        coalesce(s.sold_at, now()),
        coalesce(s.created_at, now())
      from public.sold_listings s
      left join public.listings l on l.id = s.listing_id
      where coalesce(s.sold_price, s.price, l.price, 0) > 0
      on conflict (sold_listing_id, source) where sold_listing_id is not null
      do nothing
    $backfill$;
  end if;
end;
$$;

alter table public.price_history enable row level security;

drop policy if exists "Price history readable by all" on public.price_history;
create policy "Price history readable by all"
  on public.price_history for select
  using (true);
