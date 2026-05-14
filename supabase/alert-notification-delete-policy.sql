-- Aja Supabase SQL Editorissa, jotta käyttäjä voi poistaa omia hakuvahti-ilmoituksiaan.

drop policy if exists "Käyttäjä poistaa omat ilmoituksensa" on public.alert_notifications;

create policy "Käyttäjä poistaa omat ilmoituksensa"
  on public.alert_notifications
  for delete
  using (auth.uid() = user_id);
