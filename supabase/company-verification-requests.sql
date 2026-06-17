-- Company verification requests shown in profile and admin panel.

alter table public.profiles
  add column if not exists company_verification_requested_at timestamptz;

create index if not exists profiles_company_verification_requested_idx
  on public.profiles (company_verification_requested_at desc)
  where company_verification_requested_at is not null;

create or replace function public.admin_set_company_verified(
  target_user_id uuid,
  verified boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value timestamptz;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Vain admin saa vahvistaa yrityksiä';
  end if;

  if verified then
    next_value := now();
  else
    next_value := null;
  end if;

  update public.profiles
    set
      company_verified_at = next_value,
      company_verification_requested_at = null
    where id = target_user_id
      and account_type = 'company';

  return next_value;
end;
$$;

grant execute on function public.admin_set_company_verified(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
