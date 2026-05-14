-- Tilin poisto ja puhelinnumeron 3 kk varaus.
-- Aja tämä Supabasen SQL editorissa ennen kuin tilin poisto otetaan käyttöön.

create extension if not exists "pgcrypto";

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_deletion_requests_user_created_idx
  on public.account_deletion_requests(user_id, created_at desc);

alter table public.account_deletion_requests enable row level security;

create table if not exists public.reserved_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  normalized_phone text not null,
  user_id uuid,
  reserved_until timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists reserved_phone_numbers_lookup_idx
  on public.reserved_phone_numbers(normalized_phone, reserved_until);

alter table public.reserved_phone_numbers enable row level security;

create or replace function public.normalize_reserved_phone(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  compact text;
begin
  compact := regexp_replace(coalesce(raw_phone, ''), '[^0-9+]', '', 'g');

  if compact = '' then
    return '';
  end if;

  if left(compact, 1) = '+' then
    return compact;
  end if;

  if left(compact, 2) = '00' then
    return '+' || substring(compact from 3);
  end if;

  if left(compact, 1) = '0' then
    return '+358' || substring(compact from 2);
  end if;

  return '+358' || compact;
end;
$$;

create or replace function public.prevent_reserved_profile_phone()
returns trigger
language plpgsql
as $$
declare
  next_phone text;
begin
  next_phone := public.normalize_reserved_phone(new.phone);

  if next_phone <> ''
    and exists (
      select 1
      from public.reserved_phone_numbers reserved
      where reserved.normalized_phone = next_phone
        and reserved.reserved_until > now()
        and (reserved.user_id is null or reserved.user_id <> new.id)
    )
  then
    raise exception 'phone_reserved_until_3_months';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_reserved_profile_phone_trigger
  on public.profiles;

create trigger prevent_reserved_profile_phone_trigger
  before insert or update of phone on public.profiles
  for each row
  execute function public.prevent_reserved_profile_phone();

create or replace function public.prevent_reserved_company_seller_phone()
returns trigger
language plpgsql
as $$
declare
  next_phone text;
begin
  next_phone := public.normalize_reserved_phone(new.phone);

  if next_phone <> ''
    and exists (
      select 1
      from public.reserved_phone_numbers reserved
      where reserved.normalized_phone = next_phone
        and reserved.reserved_until > now()
        and (reserved.user_id is null or reserved.user_id <> new.company_id)
    )
  then
    raise exception 'phone_reserved_until_3_months';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_reserved_company_seller_phone_trigger
  on public.company_sellers;

create trigger prevent_reserved_company_seller_phone_trigger
  before insert or update of phone on public.company_sellers
  for each row
  execute function public.prevent_reserved_company_seller_phone();

notify pgrst, 'reload schema';
