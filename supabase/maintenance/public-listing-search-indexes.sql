-- Manual maintenance script, intentionally outside automatic migrations.
-- Prepared for a separately approved database rollout; NOT executed by this task.
-- Run outside a transaction (CREATE INDEX CONCURRENTLY), after checking the
-- installed pg_trgm schema and existing indexes in the target database.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
SET search_path = public, extensions, pg_catalog;

CREATE INDEX CONCURRENTLY IF NOT EXISTS listings_public_created_id_idx
ON public.listings (created_at DESC, id DESC)
WHERE is_sold = false AND is_hidden = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS listings_public_price_id_idx
ON public.listings (price ASC, id DESC)
WHERE is_sold = false AND is_hidden = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS listings_public_title_trgm_idx
ON public.listings USING gin (title gin_trgm_ops)
WHERE is_sold = false AND is_hidden = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS listings_public_description_trgm_idx
ON public.listings USING gin (description gin_trgm_ops)
WHERE is_sold = false AND is_hidden = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS listings_public_brand_trgm_idx
ON public.listings USING gin (brand gin_trgm_ops)
WHERE is_sold = false AND is_hidden = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS listings_public_model_trgm_idx
ON public.listings USING gin (model gin_trgm_ops)
WHERE is_sold = false AND is_hidden = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS listings_public_part_number_trgm_idx
ON public.listings USING gin (part_number gin_trgm_ops)
WHERE is_sold = false AND is_hidden = false;
