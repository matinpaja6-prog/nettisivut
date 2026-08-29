alter table public.products
  add column if not exists shipping_price_no_cents integer;

update public.products
set shipping_price_no_cents = coalesce(shipping_price_no_cents, shipping_price_fi_cents, shipping_price_cents)
where shipping_available = true and shipping_price_no_cents is null;
