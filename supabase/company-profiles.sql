-- Yritys- ja yksityismyyjäprofiilit.
-- Aja Supabase SQL Editorissa ennen kuin otat yritystilien tallennuksen käyttöön.

alter table public.profiles
  add column if not exists account_type text not null default 'private'
    check (account_type in ('private', 'company')),
  add column if not exists company_name text,
  add column if not exists business_id text,
  add column if not exists company_website text,
  add column if not exists billing_email text;

create or replace function public.lock_company_identity_fields()
returns trigger
language plpgsql
as $$
begin
  if old.account_type = 'company' then
    if old.company_name is not null
      and trim(old.company_name) <> ''
      and new.company_name is distinct from old.company_name then
      raise exception 'Yrityksen nimeä ei voi muokata ensimmäisen tallennuksen jälkeen.';
    end if;

    if old.business_id is not null
      and trim(old.business_id) <> ''
      and new.business_id is distinct from old.business_id then
      raise exception 'Y-tunnusta ei voi muokata ensimmäisen tallennuksen jälkeen.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists lock_company_identity_fields on public.profiles;
create trigger lock_company_identity_fields
  before update of company_name, business_id on public.profiles
  for each row
  execute function public.lock_company_identity_fields();

notify pgrst, 'reload schema';
