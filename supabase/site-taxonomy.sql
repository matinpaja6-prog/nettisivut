-- Stores admin-editable taxonomy: vehicles, brands, categories, subcategory groups.
-- Run once in Supabase SQL editor.

create table if not exists public.site_taxonomy (
  id text primary key default 'global',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint site_taxonomy_singleton check (id = 'global')
);

insert into public.site_taxonomy (id) values ('global')
  on conflict (id) do nothing;

alter table public.site_taxonomy enable row level security;

drop policy if exists site_taxonomy_read on public.site_taxonomy;
create policy site_taxonomy_read on public.site_taxonomy
  for select using (true);

drop policy if exists site_taxonomy_admin_update on public.site_taxonomy;
create policy site_taxonomy_admin_update on public.site_taxonomy
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists site_taxonomy_admin_insert on public.site_taxonomy;
create policy site_taxonomy_admin_insert on public.site_taxonomy
  for insert to authenticated
  with check (public.is_admin(auth.uid()));
