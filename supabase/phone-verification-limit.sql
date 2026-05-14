alter table public.profiles
  add column if not exists phone_verification_count integer not null default 0;

update public.profiles
set phone_verification_count = 1
where phone_verified_at is not null
  and phone_verification_count = 0;

alter table public.profiles
  drop constraint if exists profiles_phone_verification_count_range;

alter table public.profiles
  add constraint profiles_phone_verification_count_range
  check (phone_verification_count between 0 and 2);

create or replace function public.enforce_phone_verification_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_count integer := coalesce(old.phone_verification_count, 0);
  verified_now boolean :=
    new.phone_verified_at is not null
    and new.phone_verified_at is distinct from old.phone_verified_at;
begin
  if old_count >= 2 and (
    new.phone is distinct from old.phone
    or new.pending_phone is distinct from old.pending_phone
    or new.phone_verified_at is distinct from old.phone_verified_at
    or new.phone_verification_count is distinct from old.phone_verification_count
  ) then
    raise exception 'Puhelinnumero on lukittu kahden vahvistuksen jälkeen.';
  end if;

  if new.phone is distinct from old.phone and not verified_now then
    raise exception 'Puhelinnumeron vaihto vaatii vahvistuksen.';
  end if;

  if verified_now then
    if old_count >= 2 then
      raise exception 'Puhelinnumero on lukittu kahden vahvistuksen jälkeen.';
    end if;

    new.phone_verification_count := old_count + 1;
  elsif new.phone_verification_count is distinct from old.phone_verification_count then
    raise exception 'Puhelinnumeron vahvistusmäärää ei voi muuttaa käsin.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_phone_verification_limit on public.profiles;

create trigger profiles_phone_verification_limit
before update of phone, pending_phone, phone_verified_at, phone_verification_count
on public.profiles
for each row
execute function public.enforce_phone_verification_limit();

notify pgrst, 'reload schema';
