-- ================================================================
--  ADMIN-OIKEUDET GMAILIN PERUSTEELLA
--  Aja Supabase SQL Editorissa.
--
--  Käyttö:
--    1) Käyttäjän pitää olla ensin luotu Supabase Authiin sillä Gmaililla.
--    2) Vaihda alla olevaan viimeiseen SELECTiin oma Gmail.
--    3) Aja koko tiedosto.
-- ================================================================

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = check_user_id
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Admin-oikeus profiileihin.
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Admin-oikeus ilmoituksiin: voi lukea, muokata ja poistaa kaikkia ilmoituksia.
drop policy if exists "Admins can manage all listings" on public.listings;
create policy "Admins can manage all listings"
  on public.listings
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create or replace function public.grant_admin_to_email(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  target_user_email text;
  normalized_email text;
begin
  normalized_email := lower(trim(target_email));

  if normalized_email = '' then
    raise exception 'Anna Gmail-osoite.';
  end if;

  select au.id, lower(coalesce(au.email, normalized_email))
    into target_user_id, target_user_email
  from auth.users au
  where lower(coalesce(au.email, '')) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'Käyttäjää ei löytynyt Supabase Authista sähköpostilla: %', normalized_email;
  end if;

  insert into public.admin_users (user_id, email)
  values (target_user_id, target_user_email)
  on conflict (user_id) do update
    set email = excluded.email;

  return target_user_id;
end;
$$;

revoke all on function public.grant_admin_to_email(text) from public, anon, authenticated;
grant execute on function public.grant_admin_to_email(text) to service_role;

-- VAIHDA TÄHÄN OMA SUPABASEEN LUOTU GMAIL:
-- select public.grant_admin_to_email('oma@gmail.com');

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
