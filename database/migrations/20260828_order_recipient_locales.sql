-- Persist the language that was active when the buyer placed the order.
-- Buyer communication uses this value; seller communication independently
-- uses the seller profile's preferred_locale.
alter table public.checkout_groups
  add column if not exists customer_locale text not null default 'fi';

alter table public.orders
  add column if not exists customer_locale text not null default 'fi';

alter table public.checkout_groups
  drop constraint if exists checkout_groups_customer_locale_check;
alter table public.checkout_groups
  add constraint checkout_groups_customer_locale_check
  check (customer_locale in ('fi', 'en', 'sv', 'no'));

alter table public.orders
  drop constraint if exists orders_customer_locale_check;
alter table public.orders
  add constraint orders_customer_locale_check
  check (customer_locale in ('fi', 'en', 'sv', 'no'));

comment on column public.checkout_groups.customer_locale is
  'Buyer UI language captured at checkout; used for buyer receipts and notifications.';
comment on column public.orders.customer_locale is
  'Buyer UI language captured at checkout; seller language is resolved separately from the seller profile.';
