alter table public.profiles
  add column if not exists company_verification_status text,
  add column if not exists company_verification_rejection_reason text,
  add column if not exists company_verification_decided_at timestamptz,
  add column if not exists company_verification_decided_by uuid references auth.users(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_company_verification_status_check;
alter table public.profiles
  add constraint profiles_company_verification_status_check
  check (company_verification_status is null or company_verification_status in ('pending', 'approved', 'rejected'));

update public.profiles
set company_verification_status = case
  when company_verified_at is not null then 'approved'
  when company_verification_requested_at is not null then 'pending'
  else company_verification_status
end
where company_verified_at is not null or company_verification_requested_at is not null;
