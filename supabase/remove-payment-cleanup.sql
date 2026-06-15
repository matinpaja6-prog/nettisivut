-- Removes old cash payment purchase storage from Supabase.
-- Run this in Supabase SQL Editor if the old table/function exist in production.

drop table if exists public.point_purchases cascade;
drop function if exists public.add_profile_points(uuid, integer);
