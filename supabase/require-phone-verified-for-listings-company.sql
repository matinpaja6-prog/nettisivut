-- ================================================================
--  Ilmoituksen julkaisu yritystileille ilman puhelinvahvistusta
--  Henkilo- ja yritystilit voivat julkaista ilman phone_verified_at-arvoa
--  Aja tama Supabase SQL Editorissa
-- ================================================================

drop policy if exists "Anyone can create a listing" on public.listings;

create policy "Anyone can create a listing"
on public.listings for insert
to authenticated
with check (auth.uid() = seller_id);

drop trigger if exists profiles_phone_verification_limit on public.profiles;

select pg_notify('pgrst', 'reload schema');
