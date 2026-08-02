-- Poistaa syntymäajan pysyvästi profiileista ja vanhasta Auth-metadatasta.
-- Aja Supabase SQL Editorissa kerran. Migraatio on turvallisesti uudelleenajettava.

begin;

-- get_quest_progress viittasi aiemmin birth_date-sarakkeeseen, joten funktio
-- päivitetään ennen sarakkeen poistamista.
create or replace function public.get_quest_progress(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  listings_count integer := 0;
  reviews_given_count integer := 0;
  reviews_received_count integer := 0;
  referrals_count integer := 0;
  phone_verified boolean := false;
  profile_completed boolean := false;
  claims jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into listings_count
  from public.listings where seller_id = p_user_id;

  select count(*) into reviews_given_count
  from public.seller_reviews where reviewer_id = p_user_id;

  select count(*) into reviews_received_count
  from public.seller_reviews where seller_id = p_user_id;

  select count(*) into referrals_count
  from public.referrals where referrer_id = p_user_id;

  select
    coalesce(phone_verified_at is not null, false),
    coalesce(is_completed, false)
      or (
        first_name is not null
        and last_name is not null
        and phone is not null
        and address is not null
        and postal_code is not null
        and city is not null
        and country is not null
      )
  into phone_verified, profile_completed
  from public.profiles
  where id = p_user_id;

  phone_verified := coalesce(phone_verified, false);
  profile_completed := coalesce(profile_completed, false);

  if not phone_verified then
    select exists (
      select 1 from public.company_sellers
      where company_id = p_user_id and phone_verified_at is not null
    ) into phone_verified;
  end if;

  select coalesce(jsonb_agg(quest_id), '[]'::jsonb)
  into claims
  from public.quest_claims
  where user_id = p_user_id;

  return json_build_object(
    'listings', listings_count,
    'reviews_given', reviews_given_count,
    'reviews_received', reviews_received_count,
    'referrals', referrals_count,
    'phone_verified', phone_verified,
    'profile_completed', profile_completed,
    'claimed', claims
  );
end;
$function$;

alter table public.profiles drop column if exists birth_date;

-- Rekisteröinnin vanha metadata saattoi sisältää saman tiedon.
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'birth_date'
where coalesce(raw_user_meta_data, '{}'::jsonb) ? 'birth_date';

commit;
