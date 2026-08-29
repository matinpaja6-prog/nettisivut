alter table public.companies add column if not exists shipping_countries jsonb not null default '["FI"]'::jsonb;
alter table public.companies add column if not exists default_shipping_price_no_cents integer;

update public.companies
set shipping_countries = case
  when default_shipping_price_se_cents is not null then '["FI","SE"]'::jsonb
  else '["FI"]'::jsonb
end
where shipping_countries is null or shipping_countries = '[]'::jsonb;
