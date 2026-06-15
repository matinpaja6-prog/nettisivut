alter table public.profiles
  add column if not exists phone_last_changed_at timestamptz;

update public.profiles
set phone_last_changed_at = coalesce(phone_verified_at, updated_at, created_at)
where phone is not null
  and phone <> ''
  and phone_last_changed_at is null;
