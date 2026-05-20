-- Single-row table for global site appearance settings.
-- All appearance fields live inside a single `data` JSONB column so that
-- adding new fields never requires a schema migration.
-- Run this whole file in the Supabase SQL editor (safe to re-run).

create table if not exists public.site_settings (
  id text primary key default 'global',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint site_settings_singleton check (id = 'global')
);

-- Ensure the data column exists for older installations.
alter table public.site_settings add column if not exists data jsonb not null default '{}'::jsonb;

-- Migrate legacy columns (if they still exist) into the data JSONB blob.
do $$
declare
  col text;
  legacy_cols text[] := array[
    'hero_image_url','primary_color','accent_color','background_color',
    'surface_color','text_color','muted_color','line_color',
    'topbar_color','card_color','hero_overlay'
  ];
begin
  foreach col in array legacy_cols loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'site_settings'
        and column_name = col
    ) then
      execute format(
        'update public.site_settings set data = coalesce(data, ''{}''::jsonb) || jsonb_build_object(%L, %I) where %I is not null',
        col, col, col
      );
      execute format('alter table public.site_settings drop column %I', col);
    end if;
  end loop;
end $$;

insert into public.site_settings (id) values ('global')
  on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- Anyone can read the global theme so it can be applied for all visitors.
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select using (true);

-- Only admins can update the theme.
drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Allow admins to insert the singleton row (needed for upsert).
drop policy if exists site_settings_admin_insert on public.site_settings;
create policy site_settings_admin_insert on public.site_settings
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

-- Storage bucket for hero image uploads.
insert into storage.buckets (id, name, public)
  values ('site-assets', 'site-assets', true)
  on conflict (id) do nothing;

drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read on storage.objects
  for select using (bucket_id = 'site-assets');

drop policy if exists site_assets_admin_write on storage.objects;
create policy site_assets_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'site-assets' and public.is_admin(auth.uid()))
  with check (bucket_id = 'site-assets' and public.is_admin(auth.uid()));
