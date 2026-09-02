export const NUMERIC_PRICE_FIELD = "maskines_price_numeric";

/**
 * PostgREST must project the computed field as well as order by it on a SETOF
 * RPC. Otherwise its narrowed intermediate record cannot be cast to listings.
 * Keep the public column allowlist: selecting * would hide the bug by overfetching.
 */
export function listingProjection(columns: readonly string[], sortColumn: string, isRpc: boolean) {
  return [...new Set([
    ...columns,
    ...(isRpc && sortColumn === NUMERIC_PRICE_FIELD ? [NUMERIC_PRICE_FIELD] : [])
  ])].join(",");
}
