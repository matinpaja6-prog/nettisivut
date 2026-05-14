-- ================================================================
--  MYYJAN ARVOSTELUJEN KORJAUS
--  Aja tämä Supabase SQL Editorissa
-- ================================================================

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_name text not null default 'Käyttäjä',
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 2 and 800),
  created_at timestamptz not null default now()
);

alter table if exists public.seller_reviews
  drop constraint if exists seller_reviews_seller_id_fkey;

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
with check (
  auth.uid() = reviewer_id
  and auth.uid() <> seller_id
);

create index if not exists seller_reviews_seller_id_idx
  on public.seller_reviews (seller_id);

create index if not exists seller_reviews_weekly_limit_idx
  on public.seller_reviews (seller_id, reviewer_id, created_at desc);

create or replace function public.enforce_weekly_seller_review_limit()
returns trigger
language plpgsql
as $$
begin
  if new.reviewer_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.seller_reviews sr
    where sr.seller_id = new.seller_id
      and sr.reviewer_id = new.reviewer_id
      and sr.created_at >= now() - interval '7 days'
  ) then
    raise exception 'Voit antaa samalle myyjälle vain yhden arvion viikossa.';
  end if;

  return new;
end;
$$;

drop trigger if exists seller_reviews_weekly_limit on public.seller_reviews;
create trigger seller_reviews_weekly_limit
  before insert on public.seller_reviews
  for each row
  execute function public.enforce_weekly_seller_review_limit();

select pg_notify('pgrst', 'reload schema');
