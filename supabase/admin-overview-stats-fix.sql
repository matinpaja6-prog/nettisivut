-- Korjaa admin-paneelin "Tilastot: COALESCE types numeric and text cannot be matched" -virheen.
-- Aja tämä Supabase SQL Editorissa.

drop function if exists public.admin_overview_stats();

create or replace function public.admin_overview_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_start        timestamptz := date_trunc('day', now());
  v_week_start       timestamptz := now() - interval '7 days';
  v_month_start      timestamptz := date_trunc('month', now());
  v_prev_month_start timestamptz := date_trunc('month', now()) - interval '1 month';

  profiles_total integer := 0;
  profiles_today integer := 0;
  profiles_7d integer := 0;
  profiles_month integer := 0;
  profiles_prev_month integer := 0;

  listings_total integer := 0;
  listings_today integer := 0;
  listings_7d integer := 0;
  listings_month integer := 0;
  listings_prev_month integer := 0;

  sold_total integer := 0;
  sold_today integer := 0;
  sold_7d integer := 0;
  sold_month integer := 0;
  sold_prev_month integer := 0;

  deleted_total integer := 0;
  deleted_today integer := 0;
  deleted_7d integer := 0;
  deleted_month integer := 0;

  visits_total integer := 0;
  visits_today integer := 0;
  visits_7d integer := 0;
  visits_month integer := 0;

  unique_visitors_total integer := 0;
  unique_visitors_today integer := 0;
  unique_visitors_7d integer := 0;
  unique_visitors_month integer := 0;

  revenue_total numeric := 0;
  revenue_today numeric := 0;
  revenue_7d numeric := 0;
  revenue_month numeric := 0;
  revenue_prev_month numeric := 0;

  v_sold_date_expr text := 'created_at';
  v_purchase_date_expr text := 'created_at';
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin only';
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'select count(*)::integer from public.profiles' into profiles_total;
    execute 'select count(*)::integer from public.profiles where created_at >= $1' into profiles_today using v_day_start;
    execute 'select count(*)::integer from public.profiles where created_at >= $1' into profiles_7d using v_week_start;
    execute 'select count(*)::integer from public.profiles where created_at >= $1' into profiles_month using v_month_start;
    execute 'select count(*)::integer from public.profiles where created_at >= $1 and created_at < $2'
      into profiles_prev_month using v_prev_month_start, v_month_start;
  end if;

  if to_regclass('public.listings') is not null then
    execute 'select count(*)::integer from public.listings' into listings_total;
    execute 'select count(*)::integer from public.listings where created_at >= $1' into listings_today using v_day_start;
    execute 'select count(*)::integer from public.listings where created_at >= $1' into listings_7d using v_week_start;
    execute 'select count(*)::integer from public.listings where created_at >= $1' into listings_month using v_month_start;
    execute 'select count(*)::integer from public.listings where created_at >= $1 and created_at < $2'
      into listings_prev_month using v_prev_month_start, v_month_start;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'listings' and column_name = 'is_sold'
    ) then
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'listings' and column_name = 'sold_at'
      ) then
        v_sold_date_expr := 'coalesce(sold_at, created_at)';
      end if;

      execute 'select count(*)::integer from public.listings where is_sold = true' into sold_total;
      execute format('select count(*)::integer from public.listings where is_sold = true and %s >= $1', v_sold_date_expr)
        into sold_today using v_day_start;
      execute format('select count(*)::integer from public.listings where is_sold = true and %s >= $1', v_sold_date_expr)
        into sold_7d using v_week_start;
      execute format('select count(*)::integer from public.listings where is_sold = true and %s >= $1', v_sold_date_expr)
        into sold_month using v_month_start;
      execute format('select count(*)::integer from public.listings where is_sold = true and %s >= $1 and %s < $2', v_sold_date_expr, v_sold_date_expr)
        into sold_prev_month using v_prev_month_start, v_month_start;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'listings' and column_name = 'deleted_at'
    ) then
      execute 'select count(*)::integer from public.listings where deleted_at is not null' into deleted_total;
      execute 'select count(*)::integer from public.listings where deleted_at >= $1' into deleted_today using v_day_start;
      execute 'select count(*)::integer from public.listings where deleted_at >= $1' into deleted_7d using v_week_start;
      execute 'select count(*)::integer from public.listings where deleted_at >= $1' into deleted_month using v_month_start;
    end if;
  end if;

  if sold_total = 0 and to_regclass('public.sold_listings') is not null then
    execute 'select count(*)::integer from public.sold_listings' into sold_total;
    execute 'select count(*)::integer from public.sold_listings where sold_at >= $1' into sold_today using v_day_start;
    execute 'select count(*)::integer from public.sold_listings where sold_at >= $1' into sold_7d using v_week_start;
    execute 'select count(*)::integer from public.sold_listings where sold_at >= $1' into sold_month using v_month_start;
    execute 'select count(*)::integer from public.sold_listings where sold_at >= $1 and sold_at < $2'
      into sold_prev_month using v_prev_month_start, v_month_start;
  end if;

  if to_regclass('public.deleted_listings') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'deleted_listings' and column_name = 'created_at'
    )
  then
    execute 'select count(*)::integer from public.deleted_listings' into deleted_total;
    execute 'select count(*)::integer from public.deleted_listings where created_at >= $1' into deleted_today using v_day_start;
    execute 'select count(*)::integer from public.deleted_listings where created_at >= $1' into deleted_7d using v_week_start;
    execute 'select count(*)::integer from public.deleted_listings where created_at >= $1' into deleted_month using v_month_start;
  end if;

  if to_regclass('public.site_visits') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'site_visits' and column_name = 'created_at'
    )
  then
    execute 'select count(*)::integer from public.site_visits' into visits_total;
    execute 'select count(*)::integer from public.site_visits where created_at >= $1' into visits_today using v_day_start;
    execute 'select count(*)::integer from public.site_visits where created_at >= $1' into visits_7d using v_week_start;
    execute 'select count(*)::integer from public.site_visits where created_at >= $1' into visits_month using v_month_start;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'site_visits' and column_name = 'ip'
    ) then
      execute 'select count(distinct ip)::integer from public.site_visits' into unique_visitors_total;
      execute 'select count(distinct ip)::integer from public.site_visits where created_at >= $1' into unique_visitors_today using v_day_start;
      execute 'select count(distinct ip)::integer from public.site_visits where created_at >= $1' into unique_visitors_7d using v_week_start;
      execute 'select count(distinct ip)::integer from public.site_visits where created_at >= $1' into unique_visitors_month using v_month_start;
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'site_visits' and column_name = 'ip_address'
    ) then
      execute 'select count(distinct ip_address)::integer from public.site_visits' into unique_visitors_total;
      execute 'select count(distinct ip_address)::integer from public.site_visits where created_at >= $1' into unique_visitors_today using v_day_start;
      execute 'select count(distinct ip_address)::integer from public.site_visits where created_at >= $1' into unique_visitors_7d using v_week_start;
      execute 'select count(distinct ip_address)::integer from public.site_visits where created_at >= $1' into unique_visitors_month using v_month_start;
    else
      unique_visitors_total := visits_total;
      unique_visitors_today := visits_today;
      unique_visitors_7d := visits_7d;
      unique_visitors_month := visits_month;
    end if;
  end if;

  if to_regclass('public.point_purchases') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'point_purchases' and column_name = 'amount'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'point_purchases' and column_name = 'status'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'point_purchases' and column_name = 'created_at'
    )
  then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'point_purchases' and column_name = 'completed_at'
    ) then
      v_purchase_date_expr := 'coalesce(completed_at, created_at)';
    end if;

    execute 'select coalesce(sum(amount)::numeric, 0::numeric) from public.point_purchases where status = ''completed'''
      into revenue_total;
    execute format('select coalesce(sum(amount)::numeric, 0::numeric) from public.point_purchases where status = ''completed'' and %s >= $1', v_purchase_date_expr)
      into revenue_today using v_day_start;
    execute format('select coalesce(sum(amount)::numeric, 0::numeric) from public.point_purchases where status = ''completed'' and %s >= $1', v_purchase_date_expr)
      into revenue_7d using v_week_start;
    execute format('select coalesce(sum(amount)::numeric, 0::numeric) from public.point_purchases where status = ''completed'' and %s >= $1', v_purchase_date_expr)
      into revenue_month using v_month_start;
    execute format('select coalesce(sum(amount)::numeric, 0::numeric) from public.point_purchases where status = ''completed'' and %s >= $1 and %s < $2', v_purchase_date_expr, v_purchase_date_expr)
      into revenue_prev_month using v_prev_month_start, v_month_start;
  end if;

  return jsonb_build_object(
    'profiles_total', profiles_total,
    'profiles_today', profiles_today,
    'profiles_7d', profiles_7d,
    'profiles_month', profiles_month,
    'profiles_prev_month', profiles_prev_month,
    'listings_total', listings_total,
    'listings_today', listings_today,
    'listings_7d', listings_7d,
    'listings_month', listings_month,
    'listings_prev_month', listings_prev_month,
    'sold_total', sold_total,
    'sold_today', sold_today,
    'sold_7d', sold_7d,
    'sold_month', sold_month,
    'sold_prev_month', sold_prev_month,
    'deleted_total', deleted_total,
    'deleted_today', deleted_today,
    'deleted_7d', deleted_7d,
    'deleted_month', deleted_month,
    'visits_total', visits_total,
    'visits_today', visits_today,
    'visits_7d', visits_7d,
    'visits_month', visits_month,
    'unique_visitors_total', unique_visitors_total,
    'unique_visitors_today', unique_visitors_today,
    'unique_visitors_7d', unique_visitors_7d,
    'unique_visitors_month', unique_visitors_month,
    'revenue_total', revenue_total,
    'revenue_today', revenue_today,
    'revenue_7d', revenue_7d,
    'revenue_month', revenue_month,
    'revenue_prev_month', revenue_prev_month
  );
end;
$$;

revoke all on function public.admin_overview_stats() from public, anon;
grant execute on function public.admin_overview_stats() to authenticated, service_role;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
