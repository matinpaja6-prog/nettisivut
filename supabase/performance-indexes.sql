-- Performance indexes for the growing marketplace tables.
-- Safe to run more than once in Supabase SQL editor.

create extension if not exists pg_trgm;

create index if not exists listings_seller_created_at_idx
  on public.listings (seller_id, created_at desc);

create index if not exists listings_created_at_id_idx
  on public.listings (created_at desc, id);

create index if not exists listings_vehicle_category_created_at_idx
  on public.listings (vehicle_type, category, created_at desc);

create index if not exists listings_category_subcategory_created_at_idx
  on public.listings (category, subcategory, created_at desc);

create index if not exists listings_brand_created_at_idx
  on public.listings (brand, created_at desc);

create index if not exists listings_brand_trgm_idx
  on public.listings using gin (brand gin_trgm_ops);

create index if not exists listings_model_trgm_idx
  on public.listings using gin (model gin_trgm_ops);

create index if not exists listings_title_trgm_idx
  on public.listings using gin (title gin_trgm_ops);

create index if not exists listings_description_trgm_idx
  on public.listings using gin (description gin_trgm_ops);

create index if not exists listings_vehicle_brand_model_created_at_idx
  on public.listings (vehicle_type, brand, model, created_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'is_sold'
  ) then
    execute 'create index if not exists listings_is_sold_created_at_idx on public.listings (is_sold, created_at desc)';
  end if;
end;
$$;

create index if not exists saved_listings_listing_id_idx
  on public.saved_listings (listing_id);

do $$
begin
  if to_regclass('public.messages') is not null then
    execute 'create index if not exists messages_receiver_conversation_read_at_idx on public.messages (receiver_id, conversation_id, created_at) where read_at is null';
    execute 'create index if not exists messages_receiver_unread_created_at_idx on public.messages (receiver_id, created_at desc) where read_at is null';
    execute 'create index if not exists messages_sender_created_at_idx on public.messages (sender_id, created_at desc)';
    execute 'create index if not exists messages_conversation_created_at_desc_idx on public.messages (conversation_id, created_at desc)';
    execute 'alter table public.messages replica identity full';
  end if;

  if to_regclass('public.conversations') is not null then
    execute 'create index if not exists conversations_buyer_updated_at_idx on public.conversations (buyer_id, updated_at desc)';
    execute 'create index if not exists conversations_seller_updated_at_idx on public.conversations (seller_id, updated_at desc)';
  end if;

  if to_regclass('public.alert_notifications') is not null then
    execute 'create index if not exists alert_notifications_user_seen_created_at_idx on public.alert_notifications (user_id, seen, created_at desc)';
    execute 'alter table public.alert_notifications replica identity full';
  end if;

  if to_regclass('public.purchase_review_requests') is not null then
    execute 'create index if not exists purchase_review_requests_buyer_completed_created_idx on public.purchase_review_requests (buyer_id, completed_at, created_at desc)';
    execute 'alter table public.purchase_review_requests replica identity full';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.messages') is not null and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if to_regclass('public.alert_notifications') is not null and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'alert_notifications'
  ) then
    alter publication supabase_realtime add table public.alert_notifications;
  end if;

  if to_regclass('public.purchase_review_requests') is not null and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'purchase_review_requests'
  ) then
    alter publication supabase_realtime add table public.purchase_review_requests;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.site_visits') is not null then
    execute 'create index if not exists site_visits_created_at_idx on public.site_visits (created_at desc)';

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'site_visits'
        and column_name = 'ip'
    ) then
      execute 'create index if not exists site_visits_ip_created_at_idx on public.site_visits (ip, created_at desc)';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'site_visits'
        and column_name = 'ip_address'
    ) then
      execute 'create index if not exists site_visits_ip_address_created_at_idx on public.site_visits (ip_address, created_at desc)';
    end if;
  end if;
end;
$$;
