-- Fix admin PIN crypt() lookup on Supabase.
-- Run this in Supabase SQL Editor if admin login says:
--   function crypt(text, text) does not exist

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  extension_schema text;
begin
  select namespace.nspname
    into extension_schema
  from pg_extension extension
  join pg_namespace namespace on namespace.oid = extension.extnamespace
  where extension.extname = 'pgcrypto';

  if extension_schema is distinct from 'extensions' then
    alter extension pgcrypto set schema extensions;
  end if;
end;
$$;

alter table public.admin_users
  add column if not exists pin_hash text;

create or replace function public.set_admin_pin(new_pin text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Vain admin saa asettaa PIN-koodin';
  end if;

  if new_pin is null or length(trim(new_pin)) < 4 then
    raise exception 'PIN:n täytyy olla vähintään 4 merkkiä';
  end if;

  update public.admin_users
  set pin_hash = extensions.crypt(new_pin, extensions.gen_salt('bf', 10))
  where user_id = auth.uid();
end;
$$;

revoke all on function public.set_admin_pin(text) from public, anon;
grant execute on function public.set_admin_pin(text) to authenticated;

create or replace function public.verify_admin_pin(candidate_pin text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_hash text;
begin
  if not public.is_admin(auth.uid()) then
    return false;
  end if;

  select pin_hash into v_hash
  from public.admin_users
  where user_id = auth.uid();

  if v_hash is null then
    raise exception 'PIN-koodia ei ole asetettu vielä. Aja SQL Editorissa: select public.set_admin_pin(''sinunpinkoodisi'')';
  end if;

  return extensions.crypt(candidate_pin, v_hash) = v_hash;
end;
$$;

revoke all on function public.verify_admin_pin(text) from public, anon;
grant execute on function public.verify_admin_pin(text) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
