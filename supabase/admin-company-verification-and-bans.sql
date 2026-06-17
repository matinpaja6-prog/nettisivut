-- Admin fixes:
-- - persistent company verification badge
-- - admin listing deletion really removes the listing row
-- - admin profile listing returns company_verified_at and IP metadata when available

alter table public.profiles
  add column if not exists company_verified_at timestamptz;

alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_reason text,
  add column if not exists phone_verification_count integer not null default 0,
  add column if not exists points integer not null default 0,
  add column if not exists extra_phone_verifications integer not null default 0,
  add column if not exists extra_listing_slots integer not null default 0,
  add column if not exists last_ip text,
  add column if not exists last_seen_ip text,
  add column if not exists ip_count integer not null default 0;

create table if not exists public.banned_ips (
  ip text primary key,
  reason text,
  banned_at timestamptz not null default now(),
  banned_by uuid
);

create table if not exists public.deleted_listings_log (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid,
  deleted_by uuid,
  reason text,
  deleted_at timestamptz not null default now()
);

create or replace function public.admin_set_company_verified(
  target_user_id uuid,
  verified boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value timestamptz;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Vain admin saa vahvistaa yrityksiä';
  end if;

  if verified then
    next_value := now();
  else
    next_value := null;
  end if;

  update public.profiles
    set company_verified_at = next_value
    where id = target_user_id
      and account_type = 'company';

  return next_value;
end;
$$;

drop function if exists public.admin_delete_listing(uuid, text);

create or replace function public.admin_delete_listing(
  target_listing_id uuid,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Vain admin saa poistaa ilmoituksia';
  end if;

  insert into public.deleted_listings_log (listing_id, deleted_by, reason)
  values (target_listing_id, auth.uid(), reason)
  on conflict do nothing;

  delete from public.listings
  where id = target_listing_id;
end;
$$;

drop function if exists public.admin_list_profiles(text, integer, integer);

create or replace function public.admin_list_profiles(
  search_query text default '',
  page_limit integer default 50,
  page_offset integer default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  first_name text,
  last_name text,
  phone text,
  phone_verified_at timestamptz,
  phone_verification_count integer,
  is_banned boolean,
  banned_reason text,
  points integer,
  created_at timestamptz,
  last_ip text,
  last_seen_ip text,
  ip_count integer,
  extra_phone_verifications integer,
  extra_listing_slots integer,
  is_admin boolean,
  account_type text,
  company_name text,
  business_id text,
  company_verified_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Vain admin saa kutsua tätä funktiota';
  end if;

  return query
  select
    p.id::uuid,
    coalesce(p.email, au.email, '')::text as email,
    nullif(coalesce(p.full_name, trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), p.company_name, ''), '')::text as full_name,
    p.first_name::text,
    p.last_name::text,
    p.phone::text,
    p.phone_verified_at::timestamptz,
    coalesce(p.phone_verification_count, 0)::integer,
    coalesce(p.is_banned, false)::boolean,
    p.banned_reason::text,
    coalesce(p.points, 0)::integer,
    p.created_at::timestamptz,
    p.last_ip::text,
    p.last_seen_ip::text,
    coalesce(p.ip_count, 0)::integer,
    coalesce(p.extra_phone_verifications, 0)::integer,
    coalesce(p.extra_listing_slots, 0)::integer,
    (au.user_id is not null)::boolean as is_admin,
    p.account_type::text,
    p.company_name::text,
    p.business_id::text,
    p.company_verified_at::timestamptz
  from public.profiles p
  left join public.admin_users au on au.user_id = p.id
  where
    coalesce(search_query, '') = ''
    or concat_ws(' ', p.email, p.full_name, p.first_name, p.last_name, p.phone, p.company_name, p.business_id, p.last_ip, p.last_seen_ip) ilike ('%' || search_query || '%')
  order by p.created_at desc nulls last
  limit greatest(1, least(coalesce(page_limit, 50), 300))
  offset greatest(0, coalesce(page_offset, 0));
end;
$$;

revoke all on function public.admin_set_company_verified(uuid, boolean) from public, anon;
revoke all on function public.admin_delete_listing(uuid, text) from public, anon;
revoke all on function public.admin_list_profiles(text, integer, integer) from public, anon;

grant execute on function public.admin_set_company_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_listing(uuid, text) to authenticated;
grant execute on function public.admin_list_profiles(text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
