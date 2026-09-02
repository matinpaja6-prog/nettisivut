-- Run this whole file in the SQL editor after public-listing-advanced-search.sql.
-- Does NOT change stored prices, listings, payment amounts or column types.
-- PostgREST computed field: sort/filter text prices numerically before pagination.
CREATE OR REPLACE FUNCTION public.maskines_price_numeric(public.listings)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER
AS $$
  SELECT CASE WHEN value ~ '^[0-9]{1,12}([.][0-9]{1,6})?$'
    THEN value::numeric ELSE NULL END
  FROM (SELECT replace(regexp_replace(replace(trim($1.price::text), chr(160), ''), '[[:space:]]', '', 'g'), ',', '.') AS value) cleaned
$$;

REVOKE ALL ON FUNCTION public.maskines_price_numeric(public.listings) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maskines_price_numeric(public.listings) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- This read-only check should show numeric ascending order: 20, 50, 60, ...
SELECT listing_number, price, public.maskines_price_numeric(listings) AS numeric_price
FROM public.listings
WHERE is_sold = false AND is_hidden = false
ORDER BY public.maskines_price_numeric(listings) ASC NULLS LAST, id DESC
LIMIT 10;
