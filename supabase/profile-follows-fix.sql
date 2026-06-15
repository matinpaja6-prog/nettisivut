-- ================================================================
-- PROFILE FOLLOWS FIX
-- Run this once in the Supabase SQL Editor if following fails.
-- Safe to run multiple times.
-- ================================================================

create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profile_follows
  add column if not exists created_at timestamptz not null default now();

delete from public.profile_follows
where follower_id = followed_id;

delete from public.profile_follows a
using public.profile_follows b
where a.ctid < b.ctid
  and a.follower_id = b.follower_id
  and a.followed_id = b.followed_id;

create unique index if not exists profile_follows_unique_idx
  on public.profile_follows (follower_id, followed_id);

create index if not exists profile_follows_followed_id_idx
  on public.profile_follows (followed_id, created_at desc);

create index if not exists profile_follows_follower_id_idx
  on public.profile_follows (follower_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_follows_no_self_follow'
      and conrelid = 'public.profile_follows'::regclass
  ) then
    alter table public.profile_follows
      add constraint profile_follows_no_self_follow
      check (follower_id <> followed_id);
  end if;
end $$;

alter table public.profile_follows enable row level security;

drop policy if exists "Users can read own profile follows" on public.profile_follows;
create policy "Users can read own profile follows"
on public.profile_follows for select
to authenticated
using (auth.uid() = follower_id or auth.uid() = followed_id);

drop policy if exists "Users can follow profiles" on public.profile_follows;
create policy "Users can follow profiles"
on public.profile_follows for insert
to authenticated
with check (auth.uid() = follower_id and follower_id <> followed_id);

drop policy if exists "Users can unfollow profiles" on public.profile_follows;
create policy "Users can unfollow profiles"
on public.profile_follows for delete
to authenticated
using (auth.uid() = follower_id);

create or replace function public.get_profile_follow_stats(target_profile_id uuid)
returns table (
  follower_count bigint,
  following_count bigint,
  is_following boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profile_follows pf where pf.followed_id = target_profile_id),
    (select count(*) from public.profile_follows pf where pf.follower_id = target_profile_id),
    exists (
      select 1
      from public.profile_follows pf
      where pf.follower_id = auth.uid()
        and pf.followed_id = target_profile_id
    );
$$;

revoke all on function public.get_profile_follow_stats(uuid) from public;
grant execute on function public.get_profile_follow_stats(uuid) to anon, authenticated;

create or replace function public.get_my_profile_follows()
returns table (
  direction text,
  profile_id uuid,
  account_type text,
  display_name text,
  avatar_url text,
  city text,
  country text,
  bio text,
  relation_created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    'following'::text as direction,
    p.id as profile_id,
    p.account_type::text as account_type,
    coalesce(
      nullif(trim(p.company_name), ''),
      nullif(trim(p.full_name), ''),
      nullif(trim(p.name), ''),
      nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      'Kayttaja'
    ) as display_name,
    p.avatar_url as avatar_url,
    p.city as city,
    p.country as country,
    p.bio as bio,
    pf.created_at as relation_created_at
  from public.profile_follows pf
  join public.profiles p on p.id = pf.followed_id
  where pf.follower_id = auth.uid()

  union all

  select
    'follower'::text,
    p.id,
    p.account_type::text,
    coalesce(
      nullif(trim(p.company_name), ''),
      nullif(trim(p.full_name), ''),
      nullif(trim(p.name), ''),
      nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      'Kayttaja'
    ),
    p.avatar_url,
    p.city,
    p.country,
    p.bio,
    pf.created_at
  from public.profile_follows pf
  join public.profiles p on p.id = pf.follower_id
  where pf.followed_id = auth.uid()

  order by relation_created_at desc;
$$;

revoke all on function public.get_my_profile_follows() from public, anon;
grant execute on function public.get_my_profile_follows() to authenticated;

notify pgrst, 'reload schema';
