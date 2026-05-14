-- Fix admin "Käyttäjät" RPC:
--   structure of query does not match function result type
--
-- Run this in Supabase SQL Editor.

alter table public.profiles
  add column if not exists phone_verification_count integer not null default 0,
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_reason text,
  add column if not exists points integer not null default 0,
  add column if not exists extra_phone_verifications integer not null default 0,
  add column if not exists extra_listing_slots integer not null default 0;

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
  business_id text
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
    nullif(
      coalesce(
        p.full_name,
        trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))),
        p.company_name,
        ''
      ),
      ''
    )::text as full_name,
    p.first_name::text,
    p.last_name::text,
    p.phone::text,
    p.phone_verified_at::timestamptz,
    coalesce(p.phone_verification_count, 0)::integer,
    coalesce(p.is_banned, false)::boolean,
    p.banned_reason::text,
    coalesce(p.points, 0)::integer,
    p.created_at::timestamptz,
    null::text as last_ip,
    null::text as last_seen_ip,
    0::integer as ip_count,
    coalesce(p.extra_phone_verifications, 0)::integer,
    coalesce(p.extra_listing_slots, 0)::integer,
    (au.user_id is not null)::boolean as is_admin,
    p.account_type::text,
    p.company_name::text,
    p.business_id::text
  from public.profiles p
  left join public.admin_users au on au.user_id = p.id
  where
    coalesce(search_query, '') = ''
    or concat_ws(
      ' ',
      p.email,
      p.full_name,
      p.first_name,
      p.last_name,
      p.phone,
      p.company_name,
      p.business_id
    ) ilike ('%' || search_query || '%')
  order by p.created_at desc nulls last
  limit greatest(1, least(coalesce(page_limit, 50), 300))
  offset greatest(0, coalesce(page_offset, 0));
end;
$$;

revoke all on function public.admin_list_profiles(text, integer, integer) from public, anon;
grant execute on function public.admin_list_profiles(text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
