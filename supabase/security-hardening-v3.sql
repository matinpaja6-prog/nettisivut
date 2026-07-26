begin;

-- Return the complete profile only to its authenticated owner.
create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select to_jsonb(p)
  from public.profiles as p
  where p.id = auth.uid()
  limit 1
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated, service_role;

-- Spend points atomically. A client can only spend its own points and cannot
-- race two browser requests to create a negative balance.
create or replace function public.spend_profile_points(p_cost integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  remaining_points integer;
begin
  if caller_id is null then
    return jsonb_build_object('success', false, 'points', 0, 'error', 'not_authenticated');
  end if;

  if p_cost is null or p_cost < 1 or p_cost > 100000 then
    return jsonb_build_object('success', false, 'points', 0, 'error', 'invalid_cost');
  end if;

  update public.profiles
  set points = coalesce(points, 0) - p_cost
  where id = caller_id
    and coalesce(points, 0) >= p_cost
  returning points into remaining_points;

  if not found then
    select coalesce(points, 0)
    into remaining_points
    from public.profiles
    where id = caller_id;

    return jsonb_build_object(
      'success', false,
      'points', coalesce(remaining_points, 0),
      'error', 'not_enough_points'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'points', remaining_points
  );
end;
$$;

revoke all on function public.spend_profile_points(integer) from public, anon;
grant execute on function public.spend_profile_points(integer) to authenticated, service_role;

-- Remove every legacy profile policy and replace them with a small, explicit
-- policy set. Column grants below prevent public reads of private fields even
-- though public seller cards remain available.
alter table public.profiles enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format(
      'drop policy if exists %I on public.profiles',
      policy_row.policyname
    );
  end loop;
end
$$;

create policy profiles_safe_public_select
on public.profiles
for select
to anon, authenticated
using (true);

create policy profiles_owner_update
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

revoke all on table public.profiles from public, anon, authenticated;

grant select (
  id,
  username,
  first_name,
  last_name,
  name,
  phone,
  city,
  country,
  bio,
  public_id,
  is_completed,
  online,
  last_seen,
  created_at,
  full_name,
  account_type,
  company_name,
  business_id,
  company_role,
  company_website,
  avatar_url,
  updated_at,
  public_address,
  company_verified_at,
  company_verification_requested_at
) on table public.profiles to anon, authenticated;

grant update (
  username,
  first_name,
  last_name,
  name,
  phone,
  address,
  postal_code,
  city,
  country,
  birth_date,
  bio,
  is_completed,
  online,
  last_seen,
  full_name,
  preferred_locale,
  account_type,
  company_name,
  business_id,
  company_role,
  company_website,
  billing_email,
  avatar_url,
  updated_at,
  postal_address,
  home_address,
  public_address,
  company_verification_requested_at
) on table public.profiles to authenticated;

-- Public buckets do not need broad SELECT policies for public URLs. Keep
-- authenticated owner listing access for uploads and upserts.
drop policy if exists "Avatars are publicly accessible" on storage.objects;
drop policy if exists "listing_images_public_read" on storage.objects;
drop policy if exists "site_assets_public_read" on storage.objects;
drop policy if exists "avatars_owner_select" on storage.objects;
drop policy if exists "listing_images_owner_select" on storage.objects;

create policy avatars_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy listing_images_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- These legacy SECURITY DEFINER functions are no longer called directly by
-- browsers. Keep service-role access only.
do $$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('track_site_visit', 'get_profile_follow_stats')
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      function_row.signature
    );
    execute format(
      'grant execute on function %s to service_role',
      function_row.signature
    );
  end loop;
end
$$;

commit;
