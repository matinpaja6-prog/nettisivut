-- Run this file once in Supabase SQL Editor.
-- This implementation works on Supabase Pro and does not require Auth Hooks.

drop function if exists public.hook_password_verification_attempt(jsonb);

create table if not exists public.login_rate_limits (
  identifier_hash text primary key check (char_length(identifier_hash) = 64),
  failed_count integer not null default 0 check (failed_count >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_rate_limits enable row level security;
revoke all on public.login_rate_limits from anon, authenticated, public;

create or replace function public.is_login_rate_limited(identifier text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select locked_until > now()
      from public.login_rate_limits
      where identifier_hash = identifier
    ),
    false
  );
$$;

create or replace function public.record_login_failure(
  identifier text,
  maximum_attempts integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt_count integer;
  active_lock timestamptz;
begin
  if maximum_attempts < 1 or maximum_attempts > 100 then
    raise exception 'Invalid maximum attempt count';
  end if;

  insert into public.login_rate_limits (
    identifier_hash,
    failed_count,
    window_started_at,
    locked_until,
    updated_at
  ) values (
    identifier,
    1,
    now(),
    null,
    now()
  )
  on conflict (identifier_hash) do update
  set
    failed_count = case
      when public.login_rate_limits.window_started_at < now() - interval '15 minutes' then 1
      else public.login_rate_limits.failed_count + 1
    end,
    window_started_at = case
      when public.login_rate_limits.window_started_at < now() - interval '15 minutes' then now()
      else public.login_rate_limits.window_started_at
    end,
    locked_until = case
      when public.login_rate_limits.locked_until > now() then public.login_rate_limits.locked_until
      when (
        case
          when public.login_rate_limits.window_started_at < now() - interval '15 minutes' then 1
          else public.login_rate_limits.failed_count + 1
        end
      ) >= maximum_attempts then now() + interval '15 minutes'
      else null
    end,
    updated_at = now()
  returning failed_count, locked_until into attempt_count, active_lock;

  return active_lock > now() or attempt_count >= maximum_attempts;
end;
$$;

create or replace function public.clear_login_failures(identifier text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.login_rate_limits where identifier_hash = identifier;
$$;

revoke all on function public.is_login_rate_limited(text) from public, anon, authenticated;
revoke all on function public.record_login_failure(text, integer) from public, anon, authenticated;
revoke all on function public.clear_login_failures(text) from public, anon, authenticated;

grant execute on function public.is_login_rate_limited(text) to service_role;
grant execute on function public.record_login_failure(text, integer) to service_role;
grant execute on function public.clear_login_failures(text) to service_role;

drop table if exists public.password_login_attempts;
