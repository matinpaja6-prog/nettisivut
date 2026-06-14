-- ================================================================
-- SELLER REVIEW LIKES
-- Run this in the Supabase SQL Editor.
-- ================================================================

create table if not exists public.seller_review_likes (
  review_id uuid not null references public.seller_reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists seller_review_likes_review_id_idx
  on public.seller_review_likes (review_id, created_at desc);

create index if not exists seller_review_likes_user_id_idx
  on public.seller_review_likes (user_id, created_at desc);

alter table public.seller_review_likes enable row level security;

drop policy if exists "Review likes are public to read" on public.seller_review_likes;
create policy "Review likes are public to read"
on public.seller_review_likes for select
to anon, authenticated
using (true);

drop policy if exists "Users can like seller reviews" on public.seller_review_likes;
create policy "Users can like seller reviews"
on public.seller_review_likes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can remove own seller review likes" on public.seller_review_likes;
create policy "Users can remove own seller review likes"
on public.seller_review_likes for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.get_seller_review_like_summary(review_ids uuid[])
returns table (
  review_id uuid,
  like_count bigint,
  is_liked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sr.id as review_id,
    count(srl.user_id) as like_count,
    exists (
      select 1
      from public.seller_review_likes own_like
      where own_like.review_id = sr.id
        and own_like.user_id = auth.uid()
    ) as is_liked
  from public.seller_reviews sr
  left join public.seller_review_likes srl on srl.review_id = sr.id
  where sr.id = any(review_ids)
  group by sr.id;
$$;

revoke all on function public.get_seller_review_like_summary(uuid[]) from public;
grant execute on function public.get_seller_review_like_summary(uuid[]) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
