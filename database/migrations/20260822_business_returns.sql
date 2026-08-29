create table if not exists public.company_return_policies (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default true,
  return_window_days integer not null default 14 check (return_window_days between 1 and 365),
  recipient_name text not null default '', company_name text not null default '',
  address_line text not null default '', postal_code text not null default '', city text not null default '', country text not null default 'FI',
  email text not null default '', phone text not null default '', shipping_method text not null default '', shipping_payer text not null default 'customer',
  return_identifier text not null default '', customer_service text not null default '',
  translations jsonb not null default '{}'::jsonb,
  automatic_pdf boolean not null default true, attach_to_confirmation boolean not null default true,
  attach_to_shipping boolean not null default true, customer_download boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists customer_address text;
alter table public.orders add column if not exists customer_postal_code text;
alter table public.orders add column if not exists customer_city text;
alter table public.orders add column if not exists customer_country text;
alter table public.orders add column if not exists internal_notes text not null default '';
alter table public.orders add column if not exists return_policy_snapshot jsonb;

create table if not exists public.order_returns (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  return_number text not null unique default ('RET-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  status text not null default 'requested' check (status in ('requested','pending_approval','approved','rejected','in_transit','received','inspection','refund_processing','refunded','closed')),
  reason text not null, description text not null default '', image_urls jsonb not null default '[]'::jsonb,
  tracking_code text, refund_cents integer not null default 0, deadline_at timestamptz, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.order_return_events (
  id uuid primary key default gen_random_uuid(), return_id uuid not null references public.order_returns(id) on delete cascade,
  status text not null, note text not null default '', actor_user_id uuid, created_at timestamptz not null default now()
);

create index if not exists order_returns_company_idx on public.order_returns(company_id, created_at desc);
create index if not exists order_return_events_return_idx on public.order_return_events(return_id, created_at);

alter table public.company_return_policies enable row level security;
alter table public.order_returns enable row level security;
alter table public.order_return_events enable row level security;

drop policy if exists company_return_policy_owner on public.company_return_policies;
create policy company_return_policy_owner on public.company_return_policies for all using (
  exists(select 1 from public.companies c where c.id = company_id and c.owner_user_id = auth.uid())
) with check (exists(select 1 from public.companies c where c.id = company_id and c.owner_user_id = auth.uid()));

drop policy if exists order_returns_parties on public.order_returns;
create policy order_returns_parties on public.order_returns for select using (
  exists(select 1 from public.companies c where c.id = company_id and c.owner_user_id = auth.uid())
  or exists(select 1 from public.orders o where o.id = order_id and o.customer_user_id = auth.uid())
);
