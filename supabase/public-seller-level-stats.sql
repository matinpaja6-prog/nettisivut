alter table public.listings
  add column if not exists listing_mode text not null default 'single'
  check (listing_mode in ('single', 'multiple'));

alter table if exists public.sold_listings
  add column if not exists listing_mode text not null default 'single'
  check (listing_mode in ('single', 'multiple'));

create or replace function public.get_public_seller_level_stats(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_listings integer := 0;
  v_active_single_listings integer := 0;
  v_active_multi_listings integer := 0;
  v_sold_count integer := 0;
  v_sold_single_count integer := 0;
  v_sold_multi_count integer := 0;
  v_reviews_given integer := 0;
  v_reviews_received integer := 0;
  v_phone_verified boolean := false;
  v_listings_has_mode boolean := false;
  v_sold_has_mode boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'listing_mode'
  ) into v_listings_has_mode;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sold_listings'
      and column_name = 'listing_mode'
  ) into v_sold_has_mode;

  select count(*)::integer
    into v_active_listings
  from public.listings
  where seller_id = p_user_id;

  if v_listings_has_mode then
    select count(*)::integer
      into v_active_multi_listings
    from public.listings
    where seller_id = p_user_id
      and listing_mode = 'multiple';
  end if;

  v_active_single_listings := greatest(0, v_active_listings - v_active_multi_listings);

  if to_regclass('public.sold_listings') is not null then
    select count(*)::integer
      into v_sold_count
    from public.sold_listings
    where seller_id = p_user_id;

    if v_sold_has_mode then
      select count(*)::integer
        into v_sold_multi_count
      from public.sold_listings
      where seller_id = p_user_id
        and listing_mode = 'multiple';
    end if;

    v_sold_single_count := greatest(0, v_sold_count - v_sold_multi_count);
  end if;

  select count(*)::integer
    into v_reviews_given
  from public.seller_reviews
  where reviewer_id = p_user_id;

  select count(*)::integer
    into v_reviews_received
  from public.seller_reviews
  where seller_id = p_user_id;

  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and phone_verified_at is not null
  ) into v_phone_verified;

  if not v_phone_verified and to_regclass('public.company_sellers') is not null then
    select exists (
      select 1
      from public.company_sellers
      where company_id = p_user_id
        and phone_verified_at is not null
    ) into v_phone_verified;
  end if;

  return json_build_object(
    'listings_created', v_active_listings + v_sold_count,
    'single_listings_created', v_active_single_listings + v_sold_single_count,
    'multi_listings_created', v_active_multi_listings + v_sold_multi_count,
    'sold_count', v_sold_count,
    'reviews_given', v_reviews_given,
    'reviews_received', v_reviews_received,
    'phone_verified', v_phone_verified
  );
end;
$$;

revoke all on function public.get_public_seller_level_stats(uuid) from public;
grant execute on function public.get_public_seller_level_stats(uuid) to anon, authenticated;
