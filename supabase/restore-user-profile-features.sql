begin;

-- Public seller profiles request this timestamp to show the verified-phone
-- state. Without the column grant PostgreSQL rejects the entire profile query.
grant select (phone_verified_at)
on table public.profiles
to anon, authenticated;

-- Profile pages use this safe aggregate function for public follower counts
-- and for the signed-in user's own following state.
revoke all
on function public.get_profile_follow_stats(uuid)
from public;

grant execute
on function public.get_profile_follow_stats(uuid)
to anon, authenticated, service_role;

commit;
