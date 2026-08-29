alter table public.products
  drop constraint if exists products_vat_rate_check;

alter table public.products
  add constraint products_vat_rate_check
  check (vat_rate in (-2, 0, 10, 14, 24, 25.5));

comment on column public.products.vat_rate is
  '-2 = ALV 0 %, 0 = marginaaliverotus; muut arvot ovat ALV-prosentteja.';
