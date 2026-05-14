-- ================================================================
--  ILMOITUKSEN JULKAISU – Yritystilien tuki
--  Henkilötili: vaatii profiilin oma phone_verified_at
--  Yritystili: vaatii vähintään yhden vahvistetun company_sellers-myyjän
--  Aja tämä Supabase SQL Editorissa
-- ================================================================

drop policy if exists "Anyone can create a listing" on public.listings;

create policy "Anyone can create a listing"
on public.listings for insert
to authenticated
with check (
  auth.uid() = seller_id
  and (
    -- Henkilötili: oma puhelin vahvistettu
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.account_type, 'private') = 'private'
        and p.phone is not null
        and p.phone <> ''
        and p.phone_verified_at is not null
    )
    or
    -- Yritystili: vähintään yksi myyjä on vahvistanut puhelimensa
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.account_type = 'company'
        and exists (
          select 1
          from public.company_sellers cs
          where cs.company_id = p.id
            and cs.phone_verified_at is not null
        )
    )
  )
);

select pg_notify('pgrst', 'reload schema');
