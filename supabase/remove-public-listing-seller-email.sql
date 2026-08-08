-- Remove duplicated seller email addresses from public listing data.
-- Run this after the listing column migrations in the Supabase SQL editor.

-- Keep the legacy column for backwards compatibility, but never persist an
-- authentication email in it. The canonical address remains in auth/profiles.
update public.listings
set seller_email = ''
where coalesce(seller_email, '') <> '';

alter table public.listings
  alter column seller_email set default '';

create or replace function public.clear_listing_seller_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.seller_email := '';
  return new;
end;
$$;

drop trigger if exists clear_listing_seller_email_trigger on public.listings;
create trigger clear_listing_seller_email_trigger
before insert or update of seller_email on public.listings
for each row
execute function public.clear_listing_seller_email();

revoke all on function public.clear_listing_seller_email() from public, anon, authenticated;

-- A table-level SELECT grant includes every column, so remove it first and
-- restore SELECT only for the currently existing non-email columns.
revoke select on table public.listings from anon, authenticated;

do $$
declare
  public_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into public_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'listings'
    and column_name <> 'seller_email';

  if public_columns is null then
    raise exception 'No public listing columns found';
  end if;

  execute format(
    'grant select (%s) on table public.listings to anon, authenticated',
    public_columns
  );
end;
$$;

notify pgrst, 'reload schema';
