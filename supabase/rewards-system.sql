-- ============================================
-- REWARDS / REFERRAL SYSTEM
-- Run this in Supabase SQL editor
-- ============================================

-- 1. Add points + referral columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id);

-- 2. Generate referral_code for any existing users (8 char lowercase)
UPDATE profiles
SET referral_code = LOWER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- 3. Auto-generate referral_code on insert if missing
CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := LOWER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_referral_code ON profiles;
CREATE TRIGGER trg_set_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_referral_code();

-- 4. Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_awarded integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);

-- 5. RLS for referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own referrals" ON referrals;
CREATE POLICY "Read own referrals"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Insert as referred user" ON referrals;
CREATE POLICY "Insert as referred user"
  ON referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_id AND auth.uid() <> referrer_id);

-- 6. Function: award points to referrer atomically
CREATE OR REPLACE FUNCTION public.award_referral_points(
  p_referrer_id uuid,
  p_referred_id uuid,
  p_points integer DEFAULT 100
) RETURNS json AS $$
DECLARE
  v_existing referrals%ROWTYPE;
  v_updated_rows integer;
BEGIN
  -- Block self-referral
  IF p_referrer_id = p_referred_id THEN
    RETURN json_build_object('success', false, 'error', 'self_referral');
  END IF;

  -- Verify referrer exists in profiles
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_referrer_id) THEN
    RETURN json_build_object('success', false, 'error', 'referrer_not_found');
  END IF;

  -- Verify referred user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_referred_id) THEN
    RETURN json_build_object('success', false, 'error', 'referred_user_not_found');
  END IF;

  -- Block duplicate
  SELECT * INTO v_existing FROM referrals WHERE referred_id = p_referred_id;
  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'already_referred');
  END IF;

  -- Insert referral row
  INSERT INTO referrals (referrer_id, referred_id, points_awarded)
  VALUES (p_referrer_id, p_referred_id, p_points);

  -- Award points to referrer (always)
  UPDATE profiles
  SET points = COALESCE(points, 0) + p_points
  WHERE id = p_referrer_id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  -- Try to mark referred user (may not have profile yet — that's OK)
  UPDATE profiles
  SET referred_by = p_referrer_id
  WHERE id = p_referred_id AND referred_by IS NULL;

  RETURN json_build_object(
    'success', true,
    'points', p_points,
    'referrer_updated', v_updated_rows
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.award_referral_points(uuid, uuid, integer) TO authenticated;

-- 7. Public lookup: find referrer profile by code (returns id only, no PII)
CREATE OR REPLACE FUNCTION public.get_referrer_id_by_code(p_code text)
RETURNS uuid AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM profiles WHERE referral_code = p_code LIMIT 1;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_referrer_id_by_code(text) TO anon, authenticated;
