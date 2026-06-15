create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null default '',
  gmail text not null check (gmail ~* '^[A-Z0-9._%+-]+@gmail\.com$'),
  phone text not null check (char_length(phone) between 5 and 40),
  postal_address text not null default '',
  home_address text not null default '',
  public_address text not null default '',
  city text not null check (char_length(city) between 2 and 80),
  country text not null default 'Suomi',
  birth_date date,
  online boolean not null default false,
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (auth.uid()::uuid = id::uuid);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid()::uuid = id::uuid);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid()::uuid = id::uuid)
with check (auth.uid()::uuid = id::uuid);

create table if not exists public.public_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null,
  city text not null,
  country text not null default 'Suomi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_profiles
  add column if not exists updated_at timestamptz not null default now();

alter table public.public_profiles enable row level security;

drop policy if exists "Public profiles are readable" on public.public_profiles;
create policy "Public profiles are readable"
on public.public_profiles for select
to anon, authenticated
using (true);

drop policy if exists "Users can create their public profile" on public.public_profiles;
create policy "Users can create their public profile"
on public.public_profiles for insert
to authenticated
with check (auth.uid()::uuid = id::uuid);

drop policy if exists "Users can update their public profile" on public.public_profiles;
create policy "Users can update their public profile"
on public.public_profiles for update
to authenticated
using (auth.uid()::uuid = id::uuid)
with check (auth.uid()::uuid = id::uuid);

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.public_profiles(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_name text not null default 'Käyttäjä',
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 2 and 800),
  created_at timestamptz not null default now()
);

alter table public.seller_reviews enable row level security;

drop policy if exists "Reviews are public to read" on public.seller_reviews;
create policy "Reviews are public to read"
on public.seller_reviews for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can review sellers" on public.seller_reviews;
create policy "Authenticated users can review sellers"
on public.seller_reviews for insert
to authenticated
with check (auth.uid()::uuid = reviewer_id::uuid and auth.uid()::uuid <> seller_id::uuid);

create sequence if not exists public.listing_number_seq
  as bigint
  start with 100001
  increment by 1
  minvalue 100001
  no cycle;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  listing_number bigint not null default nextval('public.listing_number_seq'),
  seller_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  original_language text not null default 'fi' check (original_language in ('fi', 'en', 'sv', 'no', 'et')),
  translations jsonb not null default '{}'::jsonb,
  listing_mode text not null default 'single' check (listing_mode in ('single', 'multiple')),
  price integer not null check (price >= 0),
  brand text not null default '',
  category text not null,
  subcategory text not null default '',
  part_number text,
  location text not null,
  condition text not null,
  description text not null check (char_length(description) between 10 and 1200),
  image_url text not null,
  image_urls text[] not null default '{}',
  seller_name text not null,
  seller_email text not null,
  seller_phone text,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists listings_listing_number_key
on public.listings(listing_number);

alter table public.listings enable row level security;

drop policy if exists "Listings are public to read" on public.listings;
create policy "Listings are public to read"
on public.listings for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can create a listing" on public.listings;
create policy "Anyone can create a listing"
on public.listings for insert
to authenticated
with check (auth.uid()::uuid = seller_id::uuid);

drop policy if exists "Users can update their own listings" on public.listings;
create policy "Users can update their own listings"
on public.listings for update
to authenticated
using (auth.uid()::uuid = seller_id::uuid)
with check (auth.uid()::uuid = seller_id::uuid);

drop policy if exists "Users can delete own listing" on public.listings;
create policy "Users can delete own listing"
on public.listings
for delete
to authenticated
using (auth.uid()::uuid = seller_id::uuid);

create table if not exists public.saved_listings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table public.saved_listings enable row level security;

drop policy if exists "Users can read own saved listings" on public.saved_listings;
create policy "Users can read own saved listings"
on public.saved_listings
for select
to authenticated
using (auth.uid()::uuid = user_id::uuid);

drop policy if exists "Users can save listings" on public.saved_listings;
create policy "Users can save listings"
on public.saved_listings
for insert
to authenticated
with check (auth.uid()::uuid = user_id::uuid);

drop policy if exists "Users can remove own saved listings" on public.saved_listings;
create policy "Users can remove own saved listings"
on public.saved_listings
for delete
to authenticated
using (auth.uid()::uuid = user_id::uuid);

create index if not exists listings_created_at_idx on public.listings (created_at desc);
create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_location_idx on public.listings (location);

create or replace function public.increment_listing_view(listing_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
  set view_count = coalesce(view_count, 0) + 1
  where id = listing_id_input;
end;
$$;

grant execute on function public.increment_listing_view(uuid) to anon, authenticated;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_buyer_seller_check check (buyer_id <> seller_id),
  constraint conversations_unique_listing_pair unique (listing_id, buyer_id, seller_id)
);

alter table public.conversations enable row level security;

drop policy if exists "Conversation participants can read" on public.conversations;
create policy "Conversation participants can read"
on public.conversations for select
to authenticated
using (auth.uid()::uuid = buyer_id::uuid or auth.uid()::uuid = seller_id::uuid);

drop policy if exists "Buyers can create listing conversations" on public.conversations;
create policy "Buyers can create listing conversations"
on public.conversations for insert
to authenticated
with check (auth.uid()::uuid = buyer_id::uuid and buyer_id::uuid <> seller_id::uuid);

drop policy if exists "Conversation participants can update" on public.conversations;
create policy "Conversation participants can update"
on public.conversations for update
to authenticated
using (auth.uid()::uuid = buyer_id::uuid or auth.uid()::uuid = seller_id::uuid)
with check (auth.uid()::uuid = buyer_id::uuid or auth.uid()::uuid = seller_id::uuid);

alter table public.conversations
  add column if not exists updated_at timestamptz not null default now();

create index if not exists conversations_buyer_idx on public.conversations (buyer_id);
create index if not exists conversations_seller_idx on public.conversations (seller_id);
create index if not exists conversations_listing_idx on public.conversations (listing_id);
create index if not exists conversations_updated_at_idx on public.conversations (updated_at desc);

drop policy if exists "Conversation participants can read profile names" on public.profiles;
create policy "Conversation participants can read profile names"
on public.profiles for select
to authenticated
using (
  auth.uid()::uuid = id::uuid
  or exists (
    select 1
    from public.conversations c
    where (auth.uid()::uuid = c.buyer_id::uuid or auth.uid()::uuid = c.seller_id::uuid)
      and (profiles.id::uuid = c.buyer_id::uuid or profiles.id::uuid = c.seller_id::uuid)
  )
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  image text,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists "Message participants can read" on public.messages;
create policy "Message participants can read"
on public.messages for select
to authenticated
using (auth.uid()::uuid = sender_id::uuid or auth.uid()::uuid = receiver_id::uuid);

drop policy if exists "Message senders can create" on public.messages;
create policy "Message senders can create"
on public.messages for insert
to authenticated
with check (
  auth.uid()::uuid = sender_id::uuid
  and exists (
    select 1
    from public.conversations c
    where c.id::uuid = conversation_id::uuid
      and c.listing_id::uuid = messages.listing_id::uuid
      and (auth.uid()::uuid = c.buyer_id::uuid or auth.uid()::uuid = c.seller_id::uuid)
      and (receiver_id::uuid = c.buyer_id::uuid or receiver_id::uuid = c.seller_id::uuid)
      and receiver_id::uuid <> sender_id::uuid
  )
);

drop policy if exists "Message receivers can mark read" on public.messages;
create policy "Message receivers can mark read"
on public.messages for update
to authenticated
using (auth.uid()::uuid = receiver_id::uuid)
with check (
  auth.uid()::uuid = receiver_id::uuid
  and sender_id::uuid <> receiver_id::uuid
);

create or replace function public.enforce_message_read_receipt_update()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.listing_id is distinct from old.listing_id
    or new.sender_id is distinct from old.sender_id
    or new.receiver_id is distinct from old.receiver_id
    or new.content is distinct from old.content
    or new.image is distinct from old.image
    or new.created_at is distinct from old.created_at then
    raise exception 'only read receipt fields can be updated on messages';
  end if;

  if old.read = true and new.read = false then
    raise exception 'message read receipt cannot be unset';
  end if;

  if old.read_at is not null and new.read_at is null then
    raise exception 'message read timestamp cannot be unset';
  end if;

  if new.read_at is not null then
    new.read := true;
  end if;

  if new.read = true and new.read_at is null then
    new.read_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists messages_read_receipt_update_guard on public.messages;
create trigger messages_read_receipt_update_guard
before update on public.messages
for each row
execute function public.enforce_message_read_receipt_update();

create index if not exists messages_conversation_created_at_idx on public.messages (conversation_id, created_at);
create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists messages_receiver_idx on public.messages (receiver_id);
create index if not exists messages_receiver_unread_idx
  on public.messages (receiver_id, conversation_id, created_at)
  where read = false;
