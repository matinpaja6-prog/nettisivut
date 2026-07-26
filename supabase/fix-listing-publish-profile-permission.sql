begin;

-- Check only the signed-in user's ban state without exposing the profiles table.
create or replace function public.current_user_can_publish_listing()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select not exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and coalesce(profile.is_banned, false)
  );
$function$;

revoke all on function public.current_user_can_publish_listing() from public;
revoke all on function public.current_user_can_publish_listing() from anon;
grant execute on function public.current_user_can_publish_listing() to authenticated;
grant execute on function public.current_user_can_publish_listing() to service_role;

-- The previous policy queried profiles with the browser role and caused
-- "permission denied for table profiles" during listing creation.
drop policy if exists "Banned users cannot insert listings" on public.listings;

create policy "Banned users cannot insert listings"
on public.listings
as restrictive
for insert
to authenticated
with check (public.current_user_can_publish_listing());

commit;
