import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MIN_DATA_POINTS = 5;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const engine_model = searchParams.get("engine_model") || "";
  const engine_cc    = searchParams.get("engine_cc")    || "";
  const category     = searchParams.get("category")     || "";
  const subcategory  = searchParams.get("subcategory")  || "";
  const yearStr      = searchParams.get("year")         || "";
  const year         = yearStr ? parseInt(yearStr, 10) : null;

  if (!category || (!engine_model && !engine_cc)) {
    return NextResponse.json({ suggestion: null });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ suggestion: null });
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseKey
  );

  // subcategory leaf = last segment after " / " (handles both "Männät" and "Moottorit / Männät")
  const subcategoryLeaf = subcategory.includes(" / ")
    ? subcategory.split(" / ").pop()!
    : subcategory;

  // Price suggestions must stay inside the selected engine. If there are
  // not enough prices for this engine, we hide the suggestion instead of
  // mixing prices from another engine family.
  function buildHistoryQuery(yearRange: number | null) {
    let q = supabase
      .from("price_history")
      .select("price, year")
      .eq("category", category)
      .gt("price", 0);

    if (engine_model) q = q.eq("engine_model", engine_model);
    if (engine_cc) q = q.eq("engine_cc", engine_cc);

    if (subcategory) {
      // match full path OR old-format leaf-only
      if (subcategoryLeaf && subcategoryLeaf !== subcategory) {
        q = q.or(`subcategory.eq.${subcategory},subcategory.eq.${subcategoryLeaf}`);
      } else {
        q = q.eq("subcategory", subcategory);
      }
    }
    if (yearRange && year) {
      q = q.gte("year", String(year - yearRange))
           .lte("year", String(year + yearRange));
    }
    return q;
  }

  function buildListingQuery(yearRange: number | null) {
    let q = supabase
      .from("listings")
      .select("price, year")
      .eq("is_hidden", false)
      .eq("is_sold", false)
      .eq("category", category)
      .gt("price", 0);

    if (engine_model) q = q.eq("engine_model", engine_model);
    if (engine_cc) q = q.eq("engine_cc", engine_cc);

    if (subcategory) {
      if (subcategoryLeaf && subcategoryLeaf !== subcategory) {
        q = q.or(`subcategory.eq.${subcategory},subcategory.eq.${subcategoryLeaf}`);
      } else {
        q = q.eq("subcategory", subcategory);
      }
    }
    if (yearRange && year) {
      q = q.gte("year", String(year - yearRange))
           .lte("year", String(year + yearRange));
    }
    return q;
  }

  async function fetchPrices(yearRange: number | null) {
    const prices: number[] = [];

    const historyResult = await buildHistoryQuery(yearRange);
    if (historyResult.data) {
      prices.push(...historyResult.data.map((row) => Number(row.price)).filter(Number.isFinite));
    }

    const listingResult = await buildListingQuery(yearRange);
    if (listingResult.data) {
      prices.push(...listingResult.data.map((row) => Number(row.price)).filter(Number.isFinite));
    }

    return prices.sort((a, b) => a - b);
  }

  const attempts: Array<{ yearRange: number | null; label: string }> = [
    { yearRange: 3,    label: "Sama moottori, lähellä vuosimallia" },
    { yearRange: null, label: "Sama moottori, kaikki vuodet" },
  ];

  for (const attempt of attempts) {
    const prices = await fetchPrices(attempt.yearRange);
    if (prices.length >= MIN_DATA_POINTS) {
      return NextResponse.json({
        suggestion: { ...buildSuggestion(prices), label: attempt.label },
      });
    }
  }

  return NextResponse.json({ suggestion: null });
}

function buildSuggestion(prices: number[]) {
  const count = prices.length;
  const avg   = Math.round(prices.reduce((a, b) => a + b, 0) / count);
  const min   = prices[0];
  const max   = prices[prices.length - 1];
  const q1    = prices[Math.floor(count * 0.25)];
  const q3    = prices[Math.floor(count * 0.75)];

  return { avg, min, max, q1, q3, count };
}
