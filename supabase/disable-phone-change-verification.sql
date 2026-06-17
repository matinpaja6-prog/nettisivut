-- Disable the old phone-change verification trigger.
-- Phone changes are saved directly from the profile page without SMS confirmation.

drop trigger if exists profiles_phone_verification_limit on public.profiles;
drop function if exists public.enforce_phone_verification_limit();

alter table public.profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists pending_phone text,
  add column if not exists phone_verification_count integer not null default 0;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
