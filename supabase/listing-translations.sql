alter table public.listings
  add column if not exists original_language text not null default 'fi',
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.listings
  drop constraint if exists listings_original_language_check;

alter table public.listings
  add constraint listings_original_language_check
  check (original_language in ('fi', 'en', 'sv', 'no', 'et'));
