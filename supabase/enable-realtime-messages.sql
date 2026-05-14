-- ================================================================
--  OTA KÄYTTÖÖN REALTIME messages-taululle
--  Aja tämä Supabase SQL Editorissa
-- ================================================================

-- Lisää messages-taulu Supabasen realtime-julkaisuun
alter publication supabase_realtime add table public.messages;

-- Varmista myös että REPLICA IDENTITY on FULL jotta payload tulee mukana
alter table public.messages replica identity full;

select pg_notify('pgrst', 'reload schema');
