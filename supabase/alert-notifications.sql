-- ================================================================
--  HAKUVAHTI -> ilmoituspalkki
--  Aja tämä Supabase SQL Editorissa.
--
--  Tämä tekee hakuvahtiosumat suoraan alert_notifications-tauluun,
--  jolloin ne näkyvät sivun yläkulman ilmoituskellossa.
--  Sähköpostilähetystä ei käytetä tässä.
-- ================================================================

create extension if not exists "pgcrypto";

-- 1. Hakuvahdit
create table if not exists public.search_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  vehicle_type text,
  category text,
  subcategory text,
  query text,
  brand text,
  year_min integer,
  year_max integer,
  condition text,
  max_price integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.search_alerts
  add column if not exists vehicle_type text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists query text,
  add column if not exists brand text,
  add column if not exists year_min integer,
  add column if not exists year_max integer,
  add column if not exists condition text,
  add column if not exists max_price integer,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

alter table public.search_alerts enable row level security;

drop policy if exists "Käyttäjä hallitsee omia vahtejaan" on public.search_alerts;
create policy "Käyttäjä hallitsee omia vahtejaan"
  on public.search_alerts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Ilmoituspalkin ilmoitukset
create table if not exists public.alert_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references public.search_alerts(id) on delete cascade,
  listing_id uuid not null,
  listing_title text not null default '',
  listing_price integer,
  listing_image_url text,
  alert_label text not null default '',
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  unique (alert_id, listing_id)
);

alter table public.alert_notifications enable row level security;

drop policy if exists "Käyttäjä lukee omat ilmoituksensa" on public.alert_notifications;
create policy "Käyttäjä lukee omat ilmoituksensa"
  on public.alert_notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "Käyttäjä päivittää omat ilmoituksensa" on public.alert_notifications;
create policy "Käyttäjä päivittää omat ilmoituksensa"
  on public.alert_notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Käyttäjä poistaa omat ilmoituksensa" on public.alert_notifications;
create policy "Käyttäjä poistaa omat ilmoituksensa"
  on public.alert_notifications
  for delete
  using (auth.uid() = user_id);

create index if not exists alert_notifications_user_seen_created_idx
  on public.alert_notifications(user_id, seen, created_at desc);

-- Realtime kellovalikkoa varten.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'alert_notifications'
  ) then
    alter publication supabase_realtime add table public.alert_notifications;
  end if;
exception
  when undefined_object then
    null;
end $$;

-- 3. Apufunktiot, jotta osumat toimivat myös jos vuosimalli on tekstinä.
create or replace function public.search_alert_listing_year(raw_year text, raw_title text, raw_description text)
returns integer
language plpgsql
immutable
as $$
declare
  source_text text;
  match_text text;
begin
  source_text := concat_ws(' ', raw_year, raw_title, raw_description);
  match_text := substring(source_text from '(19[5-9][0-9]|20[0-4][0-9])');

  if match_text is null then
    return null;
  end if;

  return match_text::integer;
end;
$$;

create or replace function public.search_alert_normalize(value text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(value, '')));
$$;

-- 4. Trigger: uusi ilmoitus -> hakuvahtiosumat ilmoituspalkkiin.
create or replace function public.create_alert_notifications_for_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_row record;
  listing_year integer;
  listing_vehicle text;
  listing_text text;
begin
  listing_year := public.search_alert_listing_year(
    coalesce(to_jsonb(new)->>'year', ''),
    coalesce(new.title, ''),
    coalesce(new.description, '')
  );

  listing_vehicle := public.search_alert_normalize(coalesce(to_jsonb(new)->>'vehicle_type', ''));
  listing_text := public.search_alert_normalize(
    concat_ws(
      ' ',
      new.title,
      new.description,
      new.brand,
      to_jsonb(new)->>'model',
      new.part_number
    )
  );

  for alert_row in
    select sa.*
    from public.search_alerts sa
    where sa.is_active = true
      and sa.user_id is distinct from new.seller_id
      and (
        sa.vehicle_type is null
        or sa.vehicle_type = ''
        or public.search_alert_normalize(sa.vehicle_type) = listing_vehicle
      )
      and (
        sa.category is null
        or sa.category = ''
        or public.search_alert_normalize(sa.category) = public.search_alert_normalize(new.category)
      )
      and (
        sa.subcategory is null
        or sa.subcategory = ''
        or public.search_alert_normalize(sa.subcategory) = public.search_alert_normalize(new.subcategory)
      )
      and (
        sa.brand is null
        or sa.brand = ''
        or public.search_alert_normalize(new.brand) like '%' || public.search_alert_normalize(sa.brand) || '%'
      )
      and (
        sa.condition is null
        or sa.condition = ''
        or public.search_alert_normalize(sa.condition) = public.search_alert_normalize(new.condition)
      )
      and (
        sa.max_price is null
        or nullif(regexp_replace(coalesce(new.price::text, ''), '[^0-9.-]', '', 'g'), '')::numeric <= sa.max_price
      )
      and (sa.year_min is null or (listing_year is not null and listing_year >= sa.year_min))
      and (sa.year_max is null or (listing_year is not null and listing_year <= sa.year_max))
      and (
        sa.query is null
        or sa.query = ''
        or listing_text like '%' || public.search_alert_normalize(sa.query) || '%'
      )
  loop
    insert into public.alert_notifications (
      user_id,
      alert_id,
      listing_id,
      listing_title,
      listing_price,
      listing_image_url,
      alert_label,
      seen
    )
    values (
      alert_row.user_id,
      alert_row.id,
      new.id,
      coalesce(new.title, ''),
      nullif(regexp_replace(coalesce(new.price::text, ''), '[^0-9.-]', '', 'g'), '')::numeric::integer,
      new.image_url,
      alert_row.label,
      false
    )
    on conflict (alert_id, listing_id) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_alert_notifications on public.listings;
create trigger trg_alert_notifications
  after insert on public.listings
  for each row
  execute function public.create_alert_notifications_for_listing();

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
