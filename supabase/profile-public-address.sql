-- Adds a separate address field for the public seller profile.
-- Run this in Supabase SQL Editor before saving public profile addresses in production.

alter table public.profiles
  add column if not exists public_address text not null default '';

notify pgrst, 'reload schema';
