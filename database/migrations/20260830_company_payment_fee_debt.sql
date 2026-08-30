alter table public.companies
  add column if not exists payment_fee_debt_cents integer not null default 0;

alter table public.companies
  drop constraint if exists companies_payment_fee_debt_nonnegative;
alter table public.companies
  add constraint companies_payment_fee_debt_nonnegative
  check (payment_fee_debt_cents >= 0);

alter table public.orders
  add column if not exists seller_fee_debt_withheld_cents integer not null default 0;

alter table public.orders
  drop constraint if exists orders_seller_fee_debt_withheld_nonnegative;
alter table public.orders
  add constraint orders_seller_fee_debt_withheld_nonnegative
  check (seller_fee_debt_withheld_cents >= 0);

create table if not exists public.company_payment_fee_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  stripe_charge_id text not null,
  stripe_refund_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  reason text not null default 'seller_cancelled_refund',
  created_at timestamptz not null default now(),
  unique (stripe_refund_id, order_id)
);

create index if not exists company_payment_fee_adjustments_company_idx
  on public.company_payment_fee_adjustments(company_id, created_at desc);

alter table public.company_payment_fee_adjustments enable row level security;

drop policy if exists company_payment_fee_adjustments_owner_select
  on public.company_payment_fee_adjustments;
create policy company_payment_fee_adjustments_owner_select
  on public.company_payment_fee_adjustments
  for select
  using (
    exists (
      select 1
      from public.companies company
      where company.id = company_id
        and company.owner_user_id = auth.uid()
    )
  );

create or replace function public.record_company_payment_fee_debt(
  target_company_id uuid,
  target_order_id uuid,
  target_stripe_charge_id text,
  target_stripe_refund_id text,
  requested_amount_cents integer,
  target_reason text default 'seller_cancelled_refund'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_amount integer;
  maximum_amount integer;
  already_recorded integer;
  recorded_amount integer;
begin
  if requested_amount_cents <= 0 then
    return 0;
  end if;

  select adjustment.amount_cents
    into existing_amount
  from public.company_payment_fee_adjustments adjustment
  where adjustment.stripe_refund_id = target_stripe_refund_id
    and adjustment.order_id = target_order_id;
  if found then
    return existing_amount;
  end if;

  select greatest(0, coalesce(order_row.stripe_processing_fee_cents, 0))
    into maximum_amount
  from public.orders order_row
  where order_row.id = target_order_id
    and order_row.company_id = target_company_id
  for update;
  if not found then
    raise exception 'Order does not belong to the company';
  end if;

  select coalesce(sum(adjustment.amount_cents), 0)
    into already_recorded
  from public.company_payment_fee_adjustments adjustment
  where adjustment.order_id = target_order_id
    and adjustment.stripe_charge_id = target_stripe_charge_id;

  recorded_amount := least(
    requested_amount_cents,
    greatest(0, maximum_amount - already_recorded)
  );
  if recorded_amount <= 0 then
    return 0;
  end if;

  insert into public.company_payment_fee_adjustments (
    company_id,
    order_id,
    stripe_charge_id,
    stripe_refund_id,
    amount_cents,
    reason
  ) values (
    target_company_id,
    target_order_id,
    target_stripe_charge_id,
    target_stripe_refund_id,
    recorded_amount,
    target_reason
  )
  on conflict (stripe_refund_id, order_id) do nothing;
  if not found then
    return 0;
  end if;

  update public.companies
  set payment_fee_debt_cents = payment_fee_debt_cents + recorded_amount,
      updated_at = now()
  where id = target_company_id;

  return recorded_amount;
end;
$$;

create or replace function public.reserve_company_payment_fee_debt(
  target_company_id uuid,
  target_order_id uuid,
  maximum_withholding_cents integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_withholding integer;
  current_debt integer;
  reserved_amount integer;
begin
  select coalesce(order_row.seller_fee_debt_withheld_cents, 0)
    into existing_withholding
  from public.orders order_row
  where order_row.id = target_order_id
    and order_row.company_id = target_company_id
  for update;
  if not found then
    raise exception 'Order does not belong to the company';
  end if;
  if existing_withholding > 0 then
    return existing_withholding;
  end if;

  select company.payment_fee_debt_cents
    into current_debt
  from public.companies company
  where company.id = target_company_id
  for update;
  if not found then
    raise exception 'Company not found';
  end if;

  reserved_amount := least(
    greatest(0, current_debt),
    greatest(0, maximum_withholding_cents)
  );
  if reserved_amount <= 0 then
    return 0;
  end if;

  update public.companies
  set payment_fee_debt_cents = payment_fee_debt_cents - reserved_amount,
      updated_at = now()
  where id = target_company_id;

  update public.orders
  set seller_fee_debt_withheld_cents = reserved_amount
  where id = target_order_id;

  return reserved_amount;
end;
$$;

create or replace function public.release_company_payment_fee_debt_reservation(
  target_company_id uuid,
  target_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reserved_amount integer;
  existing_transfer_id text;
begin
  select coalesce(order_row.seller_fee_debt_withheld_cents, 0), order_row.stripe_transfer_id
    into reserved_amount, existing_transfer_id
  from public.orders order_row
  where order_row.id = target_order_id
    and order_row.company_id = target_company_id
  for update;
  if not found or reserved_amount <= 0 or existing_transfer_id is not null then
    return 0;
  end if;

  update public.companies
  set payment_fee_debt_cents = payment_fee_debt_cents + reserved_amount,
      updated_at = now()
  where id = target_company_id;

  update public.orders
  set seller_fee_debt_withheld_cents = 0
  where id = target_order_id;

  return reserved_amount;
end;
$$;

revoke all on function public.record_company_payment_fee_debt(uuid, uuid, text, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.reserve_company_payment_fee_debt(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.release_company_payment_fee_debt_reservation(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.record_company_payment_fee_debt(uuid, uuid, text, text, integer, text)
  to service_role;
grant execute on function public.reserve_company_payment_fee_debt(uuid, uuid, integer)
  to service_role;
grant execute on function public.release_company_payment_fee_debt_reservation(uuid, uuid)
  to service_role;
