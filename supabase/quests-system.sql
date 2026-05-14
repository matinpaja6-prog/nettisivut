-- ============================================
-- QUESTS / TASKS SYSTEM
-- Run this in Supabase SQL editor (after rewards-system.sql)
-- ============================================

-- 1. Claims table: tracks which quests each user has claimed
CREATE TABLE IF NOT EXISTS public.quest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id text NOT NULL,
  points_awarded integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_claims_user ON quest_claims(user_id);

ALTER TABLE quest_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own quest claims" ON quest_claims;
CREATE POLICY "Read own quest claims"
  ON quest_claims FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Function: returns current progress on every quest for the calling user
CREATE OR REPLACE FUNCTION public.get_quest_progress(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_listings_count        integer := 0;
  v_reviews_given_count   integer := 0;
  v_reviews_received_count integer := 0;
  v_referrals_count       integer := 0;
  v_phone_verified        boolean := false;
  v_profile_completed     boolean := false;
  v_claims                jsonb := '[]'::jsonb;
BEGIN
  -- Listings created
  SELECT COUNT(*) INTO v_listings_count
  FROM listings
  WHERE seller_id = p_user_id;

  -- Reviews given by user
  SELECT COUNT(*) INTO v_reviews_given_count
  FROM seller_reviews
  WHERE reviewer_id = p_user_id;

  -- Reviews received as seller
  SELECT COUNT(*) INTO v_reviews_received_count
  FROM seller_reviews
  WHERE seller_id = p_user_id;

  -- Referrals (friends invited)
  SELECT COUNT(*) INTO v_referrals_count
  FROM referrals
  WHERE referrer_id = p_user_id;

  -- Phone + profile flags
  SELECT
    (phone_verified_at IS NOT NULL),
    COALESCE(is_completed, false) OR (
      first_name IS NOT NULL AND last_name IS NOT NULL AND
      phone IS NOT NULL AND address IS NOT NULL AND
      postal_code IS NOT NULL AND city IS NOT NULL AND
      country IS NOT NULL AND birth_date IS NOT NULL
    )
  INTO v_phone_verified, v_profile_completed
  FROM profiles
  WHERE id = p_user_id;

  -- Also count as verified if any company seller has a verified phone
  IF NOT v_phone_verified THEN
    SELECT EXISTS (
      SELECT 1 FROM company_sellers
      WHERE company_id = p_user_id
        AND phone_verified_at IS NOT NULL
    ) INTO v_phone_verified;
  END IF;

  -- Already-claimed quest ids
  SELECT COALESCE(jsonb_agg(quest_id), '[]'::jsonb) INTO v_claims
  FROM quest_claims
  WHERE user_id = p_user_id;

  RETURN json_build_object(
    'listings', v_listings_count,
    'reviews_given', v_reviews_given_count,
    'reviews_received', v_reviews_received_count,
    'referrals', v_referrals_count,
    'phone_verified', v_phone_verified,
    'profile_completed', v_profile_completed,
    'claimed', v_claims
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_quest_progress(uuid) TO authenticated;

-- 3. Function: claim a quest if completed
-- Quest definitions (id → reward + requirement) are kept here for atomicity
CREATE OR REPLACE FUNCTION public.claim_quest(p_quest_id text)
RETURNS json AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_progress  json;
  v_required  integer := 0;
  v_actual    integer := 0;
  v_points    integer := 0;
  v_completed boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Check already claimed
  IF EXISTS (SELECT 1 FROM quest_claims WHERE user_id = v_user_id AND quest_id = p_quest_id) THEN
    RETURN json_build_object('success', false, 'error', 'already_claimed');
  END IF;

  -- Get progress
  v_progress := public.get_quest_progress(v_user_id);

  -- Quest definitions
  CASE p_quest_id
    WHEN 'profile_complete' THEN
      v_completed := (v_progress->>'profile_completed')::boolean;
      v_points := 100;

    WHEN 'phone_verified' THEN
      v_completed := (v_progress->>'phone_verified')::boolean;
      v_points := 100;

    WHEN 'first_listing' THEN
      v_actual := (v_progress->>'listings')::int;
      v_required := 1;
      v_completed := v_actual >= v_required;
      v_points := 50;

    WHEN 'listings_5' THEN
      v_actual := (v_progress->>'listings')::int;
      v_required := 5;
      v_completed := v_actual >= v_required;
      v_points := 250;

    WHEN 'listings_25' THEN
      v_actual := (v_progress->>'listings')::int;
      v_required := 25;
      v_completed := v_actual >= v_required;
      v_points := 1000;

    WHEN 'first_review_given' THEN
      v_actual := (v_progress->>'reviews_given')::int;
      v_required := 1;
      v_completed := v_actual >= v_required;
      v_points := 50;

    WHEN 'reviews_given_10' THEN
      v_actual := (v_progress->>'reviews_given')::int;
      v_required := 10;
      v_completed := v_actual >= v_required;
      v_points := 500;

    WHEN 'first_review_received' THEN
      v_actual := (v_progress->>'reviews_received')::int;
      v_required := 1;
      v_completed := v_actual >= v_required;
      v_points := 50;

    WHEN 'reviews_received_10' THEN
      v_actual := (v_progress->>'reviews_received')::int;
      v_required := 10;
      v_completed := v_actual >= v_required;
      v_points := 500;

    WHEN 'referrals_5' THEN
      v_actual := (v_progress->>'referrals')::int;
      v_required := 5;
      v_completed := v_actual >= v_required;
      v_points := 200;

    ELSE
      RETURN json_build_object('success', false, 'error', 'unknown_quest');
  END CASE;

  IF NOT v_completed THEN
    RETURN json_build_object(
      'success', false,
      'error', 'not_completed',
      'progress', v_actual,
      'required', v_required
    );
  END IF;

  -- Insert claim + award points atomically
  INSERT INTO quest_claims (user_id, quest_id, points_awarded)
  VALUES (v_user_id, p_quest_id, v_points);

  UPDATE profiles
  SET points = COALESCE(points, 0) + v_points
  WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'points', v_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.claim_quest(text) TO authenticated;
