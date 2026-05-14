-- ================================================================
--  KÄYTTÄJÄN AKTIIVISUUSPROFIILI – PERSONALISOIDUT SUOSITUKSET
--  Aja tämä Supabase SQL Editorissa
-- ================================================================

create table if not exists public.user_preference_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vehicle_types jsonb not null default '{}',
  brands        jsonb not null default '{}',
  models        jsonb not null default '{}',
  categories    jsonb not null default '{}',
  search_terms  jsonb not null default '{}',
  updated_at    timestamptz not null default now()
);

alter table public.user_preference_profile enable row level security;

drop policy if exists "Users can read own preference profile" on public.user_preference_profile;
create policy "Users can read own preference profile"
on public.user_preference_profile for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can manage own preference profile" on public.user_preference_profile;
create policy "Users can manage own preference profile"
on public.user_preference_profile for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ----------------------------------------------------------------
--  track_user_activity
--  Kutsutaan security definer -tilassa jotta käyttäjä ei voi
--  manipuloida muiden profiileja.
-- ----------------------------------------------------------------

create or replace function public.track_user_activity(
  p_vehicle_type text default null,
  p_brand        text default null,
  p_model        text default null,
  p_category     text default null,
  p_search_term  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_vt    text := lower(trim(coalesce(p_vehicle_type, '')));
  v_brand text := lower(trim(coalesce(p_brand, '')));
  v_model text := lower(trim(coalesce(p_model, '')));
  v_cat   text := lower(trim(coalesce(p_category, '')));
  v_st    text := lower(trim(coalesce(p_search_term, '')));
begin
  if v_uid is null then return; end if;

  insert into public.user_preference_profile (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  update public.user_preference_profile
  set
    vehicle_types = case when v_vt != '' then
      vehicle_types || jsonb_build_object(
        v_vt, coalesce((vehicle_types ->> v_vt)::int, 0) + 1
      )
    else vehicle_types end,

    brands = case when v_brand != '' then
      brands || jsonb_build_object(
        v_brand, coalesce((brands ->> v_brand)::int, 0) + 1
      )
    else brands end,

    models = case when v_model != '' then
      models || jsonb_build_object(
        v_model, coalesce((models ->> v_model)::int, 0) + 1
      )
    else models end,

    categories = case when v_cat != '' then
      categories || jsonb_build_object(
        v_cat, coalesce((categories ->> v_cat)::int, 0) + 1
      )
    else categories end,

    search_terms = case when v_st != '' then
      search_terms || jsonb_build_object(
        v_st, coalesce((search_terms ->> v_st)::int, 0) + 1
      )
    else search_terms end,

    updated_at = now()
  where user_id = v_uid;
end;
$$;

alter function public.track_user_activity(text, text, text, text, text) owner to postgres;
revoke all on function public.track_user_activity(text, text, text, text, text) from public;
grant execute on function public.track_user_activity(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
