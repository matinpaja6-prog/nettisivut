-- Maskines Security Advisor hardening.
-- Safe to run repeatedly in the Supabase SQL Editor.

begin;

-- Prevent function/object shadowing in every SECURITY DEFINER routine and in
-- the ordinary functions currently reported by the Security Advisor.
do $hardening$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.prosecdef
        or p.proname in (
          'set_referral_code',
          'enforce_company_seller_limit',
          'normalize_reserved_phone',
          'prevent_reserved_profile_phone',
          'prevent_reserved_company_seller_phone',
          'search_alert_listing_year',
          'search_alert_normalize',
          'enforce_message_read_receipt_update'
        )
      )
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public, extensions',
      routine.signature
    );
  end loop;
end;
$hardening$;

-- Referral rewards may only be claimed by the referred account. The caller
-- cannot choose the reward amount.
create or replace function public.award_referral_points(
  p_referrer_id uuid,
  p_referred_id uuid,
  p_points integer default 100
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  reward_points constant integer := 100;
  inserted_rows integer := 0;
  updated_rows integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_referred_id then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  if p_points is distinct from reward_points then
    return json_build_object('success', false, 'error', 'invalid_points');
  end if;

  if p_referrer_id = p_referred_id then
    return json_build_object('success', false, 'error', 'self_referral');
  end if;

  if not exists (
    select 1 from public.profiles where id = p_referrer_id
  ) then
    return json_build_object('success', false, 'error', 'referrer_not_found');
  end if;

  if not exists (
    select 1 from auth.users where id = p_referred_id
  ) then
    return json_build_object('success', false, 'error', 'referred_user_not_found');
  end if;

  insert into public.referrals (
    referrer_id,
    referred_id,
    points_awarded
  )
  values (
    p_referrer_id,
    p_referred_id,
    reward_points
  )
  on conflict do nothing;

  get diagnostics inserted_rows = row_count;

  if inserted_rows = 0 then
    return json_build_object('success', false, 'error', 'already_referred');
  end if;

  update public.profiles
  set points = coalesce(points, 0) + reward_points
  where id = p_referrer_id;

  get diagnostics updated_rows = row_count;

  update public.profiles
  set referred_by = p_referrer_id
  where id = p_referred_id
    and referred_by is null;

  return json_build_object(
    'success', true,
    'points', reward_points,
    'referrer_updated', updated_rows
  );
end;
$function$;

-- Quest progress is private account data. A signed-in user may only request
-- their own progress.
create or replace function public.get_quest_progress(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  listings_count integer := 0;
  reviews_given_count integer := 0;
  reviews_received_count integer := 0;
  referrals_count integer := 0;
  phone_verified boolean := false;
  profile_completed boolean := false;
  claims jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized'
      using errcode = '42501';
  end if;

  select count(*)
  into listings_count
  from public.listings
  where seller_id = p_user_id;

  select count(*)
  into reviews_given_count
  from public.seller_reviews
  where reviewer_id = p_user_id;

  select count(*)
  into reviews_received_count
  from public.seller_reviews
  where seller_id = p_user_id;

  select count(*)
  into referrals_count
  from public.referrals
  where referrer_id = p_user_id;

  select
    coalesce(phone_verified_at is not null, false),
    coalesce(is_completed, false)
      or (
        first_name is not null
        and last_name is not null
        and phone is not null
        and address is not null
        and postal_code is not null
        and city is not null
        and country is not null
        and birth_date is not null
      )
  into phone_verified, profile_completed
  from public.profiles
  where id = p_user_id;

  phone_verified := coalesce(phone_verified, false);
  profile_completed := coalesce(profile_completed, false);

  if not phone_verified then
    select exists (
      select 1
      from public.company_sellers
      where company_id = p_user_id
        and phone_verified_at is not null
    )
    into phone_verified;
  end if;

  select coalesce(jsonb_agg(quest_id), '[]'::jsonb)
  into claims
  from public.quest_claims
  where user_id = p_user_id;

  return json_build_object(
    'listings', listings_count,
    'reviews_given', reviews_given_count,
    'reviews_received', reviews_received_count,
    'referrals', referrals_count,
    'phone_verified', phone_verified,
    'profile_completed', profile_completed,
    'claimed', claims
  );
end;
$function$;

-- Remove implicit PUBLIC execution from all SECURITY DEFINER functions.
do $hardening$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public',
      routine.signature
    );
  end loop;
end;
$hardening$;

-- Internal mutation/trigger functions are never browser-callable.
do $hardening$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'add_profile_points',
        'create_alert_notifications_for_listing',
        'record_listing_price',
        'trigger_alert_notifications'
      )
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      routine.signature
    );
    execute format(
      'grant execute on function %s to service_role',
      routine.signature
    );
  end loop;
end;
$hardening$;

-- These RPCs are valid only for signed-in users. Their function bodies also
-- enforce ownership or admin checks.
do $hardening$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'admin\_%' escape '\'
        or p.proname in (
          'award_referral_points',
          'claim_quest',
          'find_review_buyer_by_phone',
          'get_my_listing_message_counts',
          'get_quest_progress',
          'is_admin',
          'set_admin_pin',
          'set_listing_hidden',
          'track_user_activity',
          'verify_admin_pin'
        )
      )
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      routine.signature
    );
    execute format(
      'grant execute on function %s to authenticated, service_role',
      routine.signature
    );
  end loop;
end;
$hardening$;

-- These routines are intentionally available before sign-in. They expose
-- public aggregate/lookup data or collect public traffic statistics.
do $hardening$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_profile_follow_stats',
        'get_referrer_id_by_code',
        'increment_listing_view',
        'track_site_visit'
      )
  loop
    execute format(
      'revoke execute on function %s from public',
      routine.signature
    );
    execute format(
      'grant execute on function %s to anon, authenticated, service_role',
      routine.signature
    );
  end loop;
end;
$hardening$;

-- Keep future functions private until explicitly granted.
alter default privileges in schema public
  revoke execute on functions from public;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');

commit;
