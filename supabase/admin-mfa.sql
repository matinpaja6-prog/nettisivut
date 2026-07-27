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

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');

commit;
