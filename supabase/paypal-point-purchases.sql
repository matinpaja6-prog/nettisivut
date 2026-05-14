-- PayPal-pisteostot Arctic Parts -kauppaan.
-- Aja Supabase SQL Editorissa ennen oikeita maksuja.

create table if not exists public.point_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paypal_order_id text not null unique,
  paypal_capture_id text unique,
  package_id text not null,
  points integer not null check (points > 0),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'EUR',
  status text not null default 'created' check (status in ('created', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.point_purchases enable row level security;

drop policy if exists "Users can read own point purchases" on public.point_purchases;
create policy "Users can read own point purchases"
on public.point_purchases
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.add_profile_points(
  p_user_id uuid,
  p_points integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_points integer;
begin
  if p_points <= 0 then
    raise exception 'points must be positive';
  end if;

  update public.profiles
  set points = coalesce(points, 0) + p_points
  where id = p_user_id
  returning points into next_points;

  if next_points is null then
    raise exception 'profile not found';
  end if;

  return next_points;
end;
$$;

revoke all on function public.add_profile_points(uuid, integer) from public;
grant execute on function public.add_profile_points(uuid, integer) to service_role;
