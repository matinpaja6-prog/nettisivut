create table if not exists public.listing_creation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  category_rating smallint,
  details_rating smallint,
  photos_rating smallint,
  overall_rating smallint,
  comment text,
  skipped boolean not null default false,
  listing_mode text,
  vehicle_type text,
  category text,
  subcategory text,
  created_at timestamptz not null default now(),
  constraint listing_creation_feedback_one_per_user unique (user_id),
  constraint listing_creation_feedback_category_rating_check check (category_rating is null or category_rating between 1 and 5),
  constraint listing_creation_feedback_details_rating_check check (details_rating is null or details_rating between 1 and 5),
  constraint listing_creation_feedback_photos_rating_check check (photos_rating is null or photos_rating between 1 and 5),
  constraint listing_creation_feedback_overall_rating_check check (overall_rating is null or overall_rating between 1 and 5)
);

alter table public.listing_creation_feedback enable row level security;

drop policy if exists "Users can read own listing creation feedback"
  on public.listing_creation_feedback;

create policy "Users can read own listing creation feedback"
  on public.listing_creation_feedback
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own listing creation feedback"
  on public.listing_creation_feedback;

create policy "Users can insert own listing creation feedback"
  on public.listing_creation_feedback
  for insert
  with check (auth.uid() = user_id);

create index if not exists listing_creation_feedback_created_at_idx
  on public.listing_creation_feedback (created_at desc);
