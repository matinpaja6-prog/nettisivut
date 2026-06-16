-- ================================================================
--  OSTAJAN ARVOSTELUPYYNTO MYYJALLE
--  Aja tämä Supabase SQL Editorissa
-- ================================================================

create table if not exists public.purchase_review_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  conversation_id uuid not null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing_title text not null default '',
  seller_name text not null default 'Myyjä',
  due_at timestamptz not null default now(),
  seen_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint purchase_review_requests_buyer_seller_check check (buyer_id <> seller_id),
  constraint purchase_review_requests_unique_conversation unique (conversation_id)
);

alter table if exists public.purchase_review_requests
  drop constraint if exists purchase_review_requests_listing_id_fkey,
  drop constraint if exists purchase_review_requests_conversation_id_fkey;

alter table public.purchase_review_requests
  alter column due_at set default now();

alter table public.purchase_review_requests
  add column if not exists seen_at timestamptz;

alter table public.purchase_review_requests enable row level security;

drop policy if exists "Purchase review participants can read" on public.purchase_review_requests;
create policy "Purchase review participants can read"
on public.purchase_review_requests for select
to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Seller can create purchase review request" on public.purchase_review_requests;
create policy "Seller can create purchase review request"
on public.purchase_review_requests for insert
to authenticated
with check (auth.uid() = seller_id);

drop policy if exists "Buyer can complete own purchase review request" on public.purchase_review_requests;
create policy "Buyer can complete own purchase review request"
on public.purchase_review_requests for update
to authenticated
using (auth.uid() = buyer_id)
with check (auth.uid() = buyer_id);

drop policy if exists "Buyer can delete own purchase review request" on public.purchase_review_requests;
create policy "Buyer can delete own purchase review request"
on public.purchase_review_requests for delete
to authenticated
using (auth.uid() = buyer_id);

create index if not exists purchase_review_requests_buyer_due_idx
  on public.purchase_review_requests (buyer_id, due_at)
  where completed_at is null;

create index if not exists purchase_review_requests_buyer_seen_due_idx
  on public.purchase_review_requests (buyer_id, seen_at, due_at)
  where completed_at is null;

create index if not exists purchase_review_requests_seller_idx
  on public.purchase_review_requests (seller_id);

create or replace function public.find_review_buyer_by_phone(raw_phone text)
returns table (
  buyer_id uuid,
  buyer_name text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as buyer_id,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.name), ''),
      nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      p.public_id,
      'Ostaja'
    ) as buyer_name
  from public.profiles p
  where p.phone_verified_at is not null
    and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') =
      regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g')
  limit 1;
$$;

alter function public.find_review_buyer_by_phone(text) owner to postgres;
revoke all on function public.find_review_buyer_by_phone(text) from public;
grant execute on function public.find_review_buyer_by_phone(text) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
