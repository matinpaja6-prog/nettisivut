create table if not exists public.company_sellers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  phone text not null check (char_length(trim(phone)) between 5 and 40),
  phone_verified_at timestamptz,
  edit_count integer not null default 0 check (edit_count between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.company_sellers
  add column if not exists phone_verified_at timestamptz,
  add column if not exists edit_count integer not null default 0;

alter table public.company_sellers
  drop constraint if exists company_sellers_edit_count_range;

alter table public.company_sellers
  add constraint company_sellers_edit_count_range
  check (edit_count between 0 and 5);

alter table public.company_sellers enable row level security;

create index if not exists company_sellers_company_id_idx
  on public.company_sellers(company_id);

drop policy if exists "Company owners can read sellers"
  on public.company_sellers;
create policy "Company owners can read sellers"
  on public.company_sellers
  for select
  using (auth.uid() = company_id);

drop policy if exists "Company owners can create sellers"
  on public.company_sellers;
create policy "Company owners can create sellers"
  on public.company_sellers
  for insert
  with check (auth.uid() = company_id);

drop policy if exists "Company owners can update sellers"
  on public.company_sellers;
create policy "Company owners can update sellers"
  on public.company_sellers
  for update
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

drop policy if exists "Company owners can delete sellers"
  on public.company_sellers;
create policy "Company owners can delete sellers"
  on public.company_sellers
  for delete
  using (auth.uid() = company_id);

create or replace function public.enforce_company_seller_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.company_sellers
    where company_id = new.company_id
  ) >= 8 then
    raise exception 'Yrityksellä voi olla enintään 8 myyjää.';
  end if;

  return new;
end;
$$;

drop trigger if exists company_seller_limit on public.company_sellers;
create trigger company_seller_limit
  before insert on public.company_sellers
  for each row
  execute function public.enforce_company_seller_limit();

notify pgrst, 'reload schema';
