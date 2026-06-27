-- Site visit tracking for admin overview stats.
-- Run this in Supabase SQL Editor.

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  ip text,
  path text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.site_visits enable row level security;

drop policy if exists "Admins can read site visits" on public.site_visits;
create policy "Admins can read site visits"
on public.site_visits for select
to authenticated
using (public.is_admin(auth.uid()));

create index if not exists site_visits_created_at_idx
on public.site_visits (created_at desc);

create index if not exists site_visits_ip_created_at_idx
on public.site_visits (ip, created_at desc);

drop function if exists public.track_site_visit(text, text, text);

create or replace function public.track_site_visit(
  p_ip text default null,
  p_path text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.site_visits (ip, path, user_agent)
  values (
    nullif(trim(coalesce(p_ip, '')), ''),
    nullif(left(trim(coalesce(p_path, '')), 500), ''),
    nullif(left(trim(coalesce(p_user_agent, '')), 500), '')
  );
end;
$$;

alter function public.track_site_visit(text, text, text) owner to postgres;
revoke all on function public.track_site_visit(text, text, text) from public;
grant execute on function public.track_site_visit(text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
