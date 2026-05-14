-- ================================================================
--  HAKUVAHTI  (Search Alerts)
--  Aja tämä Supabase SQL Editorissa
-- ================================================================

-- 1. Hakuvahti-taulu
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS search_alerts (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label          TEXT        NOT NULL,
  vehicle_type   TEXT,
  category       TEXT,
  query          TEXT,
  max_price      INTEGER,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE search_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Käyttäjä hallitsee omia vahtejaan"
  ON search_alerts FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 2. Lähetettyjen ilmoitusten seuranta (estää tuplaviestityksen)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS search_alert_notifications (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id    UUID        NOT NULL REFERENCES search_alerts(id) ON DELETE CASCADE,
  listing_id  UUID        NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alert_id, listing_id)
);

ALTER TABLE search_alert_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON search_alert_notifications FOR ALL
  USING (false);


-- 3. Funktio: etsi täsmäävät vahdit uudelle ilmoitukselle
--    Palauttaa rivit {alert_id, user_id, user_email, label}
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_matching_alerts(
  p_listing_id    UUID,
  p_title         TEXT,
  p_description   TEXT,
  p_part_number   TEXT,
  p_vehicle_type  TEXT,
  p_category      TEXT,
  p_brand         TEXT,
  p_price         NUMERIC
)
RETURNS TABLE (
  alert_id   UUID,
  user_id    UUID,
  user_email TEXT,
  label      TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id          AS alert_id,
    sa.user_id     AS user_id,
    au.email       AS user_email,
    sa.label       AS label
  FROM search_alerts sa
  JOIN auth.users au ON au.id = sa.user_id
  WHERE sa.is_active = true
    -- Ajoneuvoluokka täsmää tai vahtia ei ole rajattu
    AND (sa.vehicle_type IS NULL OR sa.vehicle_type = p_vehicle_type)
    -- Kategoria täsmää tai vahtia ei ole rajattu
    AND (sa.category IS NULL OR sa.category = p_category)
    -- Hintaraja
    AND (sa.max_price IS NULL OR p_price <= sa.max_price)
    -- Hakusana löytyy otsikosta, kuvauksesta, varaosanumerosta tai merkistä
    AND (
      sa.query IS NULL
      OR lower(p_title)       LIKE '%' || lower(sa.query) || '%'
      OR lower(p_description) LIKE '%' || lower(sa.query) || '%'
      OR lower(p_part_number) LIKE '%' || lower(sa.query) || '%'
      OR lower(p_brand)       LIKE '%' || lower(sa.query) || '%'
    )
    -- Ei ole jo lähetetty tästä ilmoituksesta
    AND NOT EXISTS (
      SELECT 1 FROM search_alert_notifications san
      WHERE san.alert_id  = sa.id
        AND san.listing_id = p_listing_id
    );
END;
$$;


-- 4. Trigger-funktio: kutsuu Edge Functionia uuden ilmoituksen yhteydessä
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_search_alerts_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  _matches RECORD;
  _payload JSONB;
BEGIN
  -- Kerää täsmäävät vahdit
  FOR _matches IN
    SELECT * FROM find_matching_alerts(
      NEW.id,
      COALESCE(NEW.title, ''),
      COALESCE(NEW.description, ''),
      COALESCE(NEW.part_number, ''),
      COALESCE(NEW.vehicle_type, ''),
      COALESCE(NEW.category, ''),
      COALESCE(NEW.brand, ''),
      COALESCE(NULLIF(regexp_replace(COALESCE(NEW.price::text, ''), '[^0-9.-]', '', 'g'), '')::numeric, 0)
    )
  LOOP
    -- Merkitse lähetetyksi (estää kaksoislähetys)
    INSERT INTO search_alert_notifications (alert_id, listing_id)
    VALUES (_matches.alert_id, NEW.id)
    ON CONFLICT DO NOTHING;

    -- Lähetä webhook Edge Functionille (pg_net täytyy olla aktivoitu)
    -- Korvaa URL omalla Supabase projektiURLillasi
    _payload := jsonb_build_object(
      'to',         _matches.user_email,
      'alert_label', _matches.label,
      'listing_id',  NEW.id,
      'listing_title', NEW.title,
      'listing_price', NEW.price,
      'listing_url', 'https://sinun-sivustosi.fi/listing/' || NEW.id::text
    );

    PERFORM net.http_post(
      url     := 'https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/send-alert-email',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <SUPABASE_SERVICE_ROLE_KEY>"}'::jsonb,
      body    := _payload
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- 5. Liitä trigger listings-tauluun
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_search_alerts ON listings;

CREATE TRIGGER trg_notify_search_alerts
  AFTER INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION notify_search_alerts_trigger();


-- ================================================================
--  EDGE FUNCTION  (luo tiedosto: supabase/functions/send-alert-email/index.ts)
--  Tarvitset: Resend API-avaimen  https://resend.com  (ilmainen tili)
--
--  Komennot terminaalissa:
--    npx supabase functions new send-alert-email
--    npx supabase functions deploy send-alert-email
--    npx supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
-- ================================================================

-- ================================================================
--  pg_net aktivointi (jos ei ole päällä):
--  Supabase Dashboard → Database → Extensions → etsi "pg_net" → Enable
-- ================================================================
