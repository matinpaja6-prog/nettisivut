-- ================================================================
--  PROFIILIKUVA – AVATAR UPLOAD
--  Aja tämä Supabase SQL Editorissa
-- ================================================================

-- 1. Lisää avatar_url-sarake profiileihin
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. Luo julkinen "avatars"-storage-bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. Storage-politiikat
drop policy if exists "Avatars are publicly accessible" on storage.objects;
create policy "Avatars are publicly accessible"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
