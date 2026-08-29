alter table public.companies
  add column if not exists default_vat_rate numeric(5,2) not null default -2;

update public.companies
set default_vat_rate = -2
where default_vat_rate is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_default_vat_rate_check'
  ) then
    alter table public.companies
      add constraint companies_default_vat_rate_check
      check (default_vat_rate in (-2, 0, 10, 14, 24, 25.5));
  end if;
end $$;
