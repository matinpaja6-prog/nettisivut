-- Require complete contact details before a signed-in user can publish a listing.
-- This is enforced in the database in addition to the application checks.

begin;

create or replace function public.current_user_has_listing_contact_details()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and nullif(btrim(profile.phone), '') is not null
      and nullif(btrim(profile.address), '') is not null
      and nullif(btrim(profile.postal_code), '') is not null
      and nullif(btrim(profile.city), '') is not null
      and nullif(btrim(profile.country), '') is not null
  );
$function$;

revoke all on function public.current_user_has_listing_contact_details() from public;
revoke all on function public.current_user_has_listing_contact_details() from anon;
grant execute on function public.current_user_has_listing_contact_details() to authenticated;
grant execute on function public.current_user_has_listing_contact_details() to service_role;

drop policy if exists "Complete profile required to insert listings" on public.listings;

create policy "Complete profile required to insert listings"
on public.listings
as restrictive
for insert
to authenticated
with check (public.current_user_has_listing_contact_details());

commit;

select pg_notify('pgrst', 'reload schema');
