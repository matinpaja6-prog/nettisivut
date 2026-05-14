-- ================================================================
--  ILMOITUKSEN JULKAISU VAATII VAHVISTETUN PUHELINNUMERON
--  Aja tämä Supabase SQL Editorissa
-- ================================================================

drop policy if exists "Anyone can create a listing" on public.listings;

create policy "Anyone can create a listing"
on public.listings for insert
to authenticated
with check (
  auth.uid() = seller_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.phone is not null
      and p.phone <> ''
      and p.phone_verified_at is not null
  )
);

select pg_notify('pgrst', 'reload schema');
