-- ============================================================================
-- Admin-paneelin Authenticator MFA ja yhden aktiivisen istunnon rajoitus
--
-- Aja tämä tiedosto Supabase SQL Editorissa vasta kun admin-roles.sql on ajettu.
-- Tämän jälkeen:
--   1. Admin-roolin voi tarkistaa ennen MFA:ta funktiolla has_admin_role().
--   2. Kaikki is_admin()-tarkistusta käyttävät RPC:t ja RLS-käytännöt vaativat
--      Supabase Authin AAL2-tason sekä viimeksi aktivoidun admin-istunnon.
--   3. Vanha yhteinen admin-PIN ei ole enää käytettävissä selaimesta.
-- ============================================================================

begin;

alter table public.admin_users
  add column if not exists active_session_id uuid,
  add column if not exists active_session_changed_at timestamptz;

-- Enintään yksi käyttäjä voi omistaa admin-roolin. Jos vanhassa tietokannassa
-- on useita admineja, indeksi pysäyttää migraation poistamatta ketään automaattisesti.
create unique index if not exists admin_users_single_admin_idx
  on public.admin_users ((true));

create unique index if not exists admin_users_active_session_id_key
  on public.admin_users (active_session_id)
  where active_session_id is not null;

-- Tätä käytetään vain tarkistamaan, kuuluuko kirjautunut käyttäjä admin-listaan.
-- Selain ei voi kysellä muiden käyttäjien admin-roolia UUID:n avulla.
create or replace function public.has_admin_role(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    check_user_id is not null
    and (
      auth.role() = 'service_role'
      or check_user_id = auth.uid()
    )
    and exists (
      select 1
      from public.admin_users au
      where au.user_id = check_user_id
    );
$$;

revoke all on function public.has_admin_role(uuid) from public, anon;
grant execute on function public.has_admin_role(uuid) to authenticated, service_role;

-- Aktivointi sallitaan vain oikealle adminille ja Supabase Authin AAL2-istunnolle.
-- Uusi aktivointi korvaa saman adminin aikaisemman aktiivisen istunnon.
create or replace function public.activate_admin_session()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  jwt_aal text := coalesce(auth.jwt() ->> 'aal', '');
  jwt_session_id_text text := nullif(auth.jwt() ->> 'session_id', '');
  jwt_session_id uuid;
begin
  if caller_id is null then
    raise exception 'Kirjautuminen puuttuu.' using errcode = '42501';
  end if;

  if not public.has_admin_role(caller_id) then
    raise exception 'Vain admin voi aktivoida admin-istunnon.' using errcode = '42501';
  end if;

  if jwt_aal <> 'aal2' then
    raise exception 'Authenticator-vahvistus vaaditaan.' using errcode = '42501';
  end if;

  if jwt_session_id_text is null then
    raise exception 'Istuntotunniste puuttuu.' using errcode = '42501';
  end if;

  begin
    jwt_session_id := jwt_session_id_text::uuid;
  exception when invalid_text_representation then
    raise exception 'Virheellinen istuntotunniste.' using errcode = '42501';
  end;

  update public.admin_users
  set active_session_id = jwt_session_id,
      active_session_changed_at = now()
  where user_id = caller_id;

  if not found then
    raise exception 'Admin-oikeutta ei löytynyt.' using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke all on function public.activate_admin_session() from public, anon;
grant execute on function public.activate_admin_session() to authenticated;

-- Kaikki olemassa olevat admin-RPC:t ja RLS-käytännöt kutsuvat is_admin()-
-- funktiota. Siksi MFA ja aktiivinen istunto tulevat voimaan myös palvelinpuolella,
-- eivät ainoastaan admin-paneelin käyttöliittymässä.
create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when auth.role() = 'service_role' then
      check_user_id is not null
      and exists (
        select 1
        from public.admin_users au
        where au.user_id = check_user_id
      )
    else
      check_user_id is not null
      and check_user_id = auth.uid()
      and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      and nullif(auth.jwt() ->> 'session_id', '') is not null
      and exists (
        select 1
        from public.admin_users au
        where au.user_id = check_user_id
          and au.active_session_id::text = auth.jwt() ->> 'session_id'
      )
  end;
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

-- Vanha jaettu PIN poistetaan käytöstä julkisesta API:sta. Sarake voidaan jättää
-- tietokantaan turvallista palautusta varten, mutta selain ei voi kutsua funktioita.
do $$
begin
  if to_regprocedure('public.verify_admin_pin(text)') is not null then
    execute 'revoke all on function public.verify_admin_pin(text) from public, anon, authenticated';
  end if;

  if to_regprocedure('public.set_admin_pin(text)') is not null then
    execute 'revoke all on function public.set_admin_pin(text) from public, anon, authenticated';
  end if;
end;
$$;

-- Vaarallisten toimintojen lyhytikäiset kertakäyttöluvat. Tauluun ei ole
-- selainrooleille yhtään RLS-käytäntöä tai oikeutta; vain palvelimen service role
-- voi luoda ja kuluttaa lupia.
create table if not exists public.admin_action_approvals (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(user_id) on delete cascade,
  session_id uuid not null,
  action text not null check (action in ('ban-user', 'ban-ip', 'delete-listing', 'delete-user')),
  token_hash text not null unique,
  totp_verified_at bigint,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_action_approvals
  add column if not exists totp_verified_at bigint;

alter table public.admin_action_approvals
  drop constraint if exists admin_action_approvals_action_check;
alter table public.admin_action_approvals
  add constraint admin_action_approvals_action_check
  check (action in ('ban-user', 'ban-ip', 'delete-listing', 'delete-user'));

create index if not exists admin_action_approvals_expiry_idx
  on public.admin_action_approvals (expires_at);

-- Sama Authenticator-vahvistus saa tuottaa vain yhden luvan. Uusi suojattu
-- toiminto vaatii siten aina uuden kuusinumeroisen koodin myös API-tasolla.
create unique index if not exists admin_action_approvals_one_per_totp_idx
  on public.admin_action_approvals (admin_user_id, session_id, totp_verified_at)
  where totp_verified_at is not null;

alter table public.admin_action_approvals enable row level security;
revoke all on table public.admin_action_approvals from public, anon, authenticated;
grant all on table public.admin_action_approvals to service_role;

-- Vaarallisia vanhoja RPC-funktioita ei saa kutsua suoraan selaimesta, koska ne
-- ohittaisivat kertakäyttöisen step-up-luvan. Next.jsin admin-API tekee nämä
-- toiminnot vasta uuden Authenticator-vahvistuksen jälkeen.
do $$
declare
  function_signature text;
begin
  for function_signature in
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_ban_user', 'admin_ban_ip', 'admin_delete_listing', 'admin_delete_user')
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      function_signature
    );
  end loop;
end;
$$;

-- Admin tarvitsee kaikkien ilmoitusten lukuoikeuden hallintanäkymään, mutta
-- selain ei saa enää yleistä admin-poisto- tai muokkausoikeutta tauluun.
drop policy if exists "Admins can manage all listings" on public.listings;
drop policy if exists "Admins can read all listings" on public.listings;
create policy "Admins can read all listings"
  on public.listings
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');

commit;
