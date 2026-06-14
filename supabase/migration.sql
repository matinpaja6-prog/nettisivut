alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists email text not null default '',
  add column if not exists postal_address text not null default '',
  add column if not exists home_address text not null default '',
  add column if not exists public_address text not null default '',
  add column if not exists country text not null default 'Suomi',
  add column if not exists birth_date date,
  add column if not exists online boolean not null default false,
  add column if not exists last_seen timestamptz;

alter table public.listings
  add column if not exists vehicle_type text not null default '',
  add column if not exists seller_id uuid references public.profiles(id) on delete set null,
  add column if not exists brand text not null default '',
  add column if not exists category text not null default 'Koti',
  add column if not exists subcategory text not null default '',
  add column if not exists location text not null default '',
  add column if not exists condition text not null default 'Hyvä',
  add column if not exists description text not null default '',
  add column if not exists image_url text not null default '',
  add column if not exists image_urls text[] not null default '{}';

alter table public.listings
  add column if not exists seller_name text not null default '',
  add column if not exists seller_email text not null default '',
  add column if not exists seller_phone text;

alter table public.listings add column if not exists engine_cc text;
alter table public.listings add column if not exists engine_model text;
alter table public.listings add column if not exists company_name text;
alter table public.listings add column if not exists seller_avatar_url text;

-- Backfill company_name for existing company listings
update public.listings l
set company_name = p.company_name
from public.profiles p
where l.seller_id = p.id
  and l.company_name is null
  and p.account_type = 'company'
  and p.company_name is not null;

-- Backfill seller_avatar_url for all existing listings
update public.listings l
set seller_avatar_url = p.avatar_url
from public.profiles p
where l.seller_id = p.id
  and l.seller_avatar_url is null
  and p.avatar_url is not null;

alter table public.listings
  add column if not exists view_count integer not null default 0;

alter table public.listings
  drop constraint if exists listings_view_count_check,
  add constraint listings_view_count_check check (view_count >= 0);

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

drop policy if exists "Users can delete their own listings" on public.listings;
create policy "Users can delete their own listings"
on public.listings for delete
to authenticated
using (auth.uid()::uuid = seller_id::uuid);

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

drop policy if exists "Public seller profiles are readable" on public.profiles;

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

alter table public.public_profiles
  add column if not exists updated_at timestamptz not null default now();

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
      and receiver_id <> sender_id
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
