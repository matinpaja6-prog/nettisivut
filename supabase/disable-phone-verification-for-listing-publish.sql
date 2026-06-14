-- ================================================================
--  Poista puhelinnumeron vahvistusvaatimus ilmoituksen julkaisusta
--  Aja tama Supabase SQL Editorissa nykyiseen projektiin
-- ================================================================

drop policy if exists "Anyone can create a listing" on public.listings;

create policy "Anyone can create a listing"
on public.listings for insert
to authenticated
with check (auth.uid() = seller_id);

drop trigger if exists profiles_phone_verification_limit on public.profiles;

select pg_notify('pgrst', 'reload schema');
