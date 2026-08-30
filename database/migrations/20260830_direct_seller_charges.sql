-- Direct Connect charges put the payment, Stripe processing costs, refunds
-- and disputes on the seller's Stripe account. Maskines retains its 1%
-- application fee, so the former cross-order payment-fee debt ledger is no
-- longer needed.

-- Existing accounts were created with platform fee/loss responsibility. Those
-- responsibilities can't be changed after the merchant configuration exists,
-- so require each seller to complete a new Stripe connection before taking
-- another payment. The old Stripe accounts and their history remain in Stripe.
update public.companies
set stripe_account_id = null,
    stripe_details_submitted = false,
    stripe_charges_enabled = false,
    stripe_payouts_enabled = false,
    updated_at = now()
where stripe_account_id is not null;

drop function if exists public.record_company_payment_fee_debt(uuid, uuid, text, text, integer, text);
drop function if exists public.reserve_company_payment_fee_debt(uuid, uuid, integer);
drop function if exists public.release_company_payment_fee_debt_reservation(uuid, uuid);

drop table if exists public.company_payment_fee_adjustments;

alter table public.companies
  drop column if exists payment_fee_debt_cents;

alter table public.orders
  drop column if exists seller_fee_debt_withheld_cents;
