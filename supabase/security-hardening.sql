-- Run after the other Maskines migrations in the Supabase SQL editor.
-- This migration is idempotent and hardens the database without changing
-- the explicit anon/authenticated grants required by the application.

begin;

-- Application roles may use public objects, but must never create objects in
-- the API-exposed schema.
revoke create on schema public from public;
revoke create on schema public from anon;
revoke create on schema public from authenticated;

-- PostgreSQL grants function execution to PUBLIC by default. Require every
-- future function to receive an intentional role grant instead.
alter default privileges in schema public
  revoke execute on functions from public;

-- SECURITY DEFINER functions run with their owner's privileges. Pin their
-- lookup path and remove any accidental default PUBLIC execution grant.
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
      'alter function %s set search_path = pg_catalog, public',
      routine.signature
    );
    execute format(
      'revoke execute on function %s from public',
      routine.signature
    );
  end loop;
end
$hardening$;

-- RLS is the final protection even if a browser request bypasses application
-- code. Missing tables are skipped so this can run across deployment stages.
do $hardening$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'public_profiles',
    'listings',
    'saved_listings',
    'conversations',
    'messages',
    'seller_reviews',
    'seller_review_likes',
    'profile_follows',
    'sold_listings',
    'search_alerts',
    'alert_notifications',
    'search_alert_notifications',
    'account_deletion_requests',
    'reserved_phone_numbers',
    'company_sellers',
    'admin_users',
    'banned_ips',
    'deleted_listings_log',
    'purchase_review_requests',
    'price_history',
    'quest_claims',
    'referrals',
    'user_preference_profile',
    'site_visits',
    'site_settings',
    'site_taxonomy'
  ]
  loop
    if to_regclass('public.' || quote_ident(table_name)) is not null then
      execute format(
        'alter table public.%I enable row level security',
        table_name
      );
    end if;
  end loop;
end
$hardening$;

commit;
