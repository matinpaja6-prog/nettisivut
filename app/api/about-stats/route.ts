import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ListingStatsRow = {
  seller_id: string | null;
  location: string | null;
  vehicle_type: string | null;
};

type ProfileCountryRow = {
  id: string;
  country: string | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("fi-FI");
}

function normalizeVehicleType(value: string | null | undefined) {
  const normalized = normalizeText(value);

  if (!normalized) return "";
  if (normalized.includes("kelkka")) return "moottorikelkka";
  if (normalized.includes("mönkij") || normalized.includes("monkij")) return "mönkijä";
  if (normalized.includes("moto") || normalized.includes("cross") || normalized.includes("enduro")) return "motocross";
  if (normalized.includes("mopo")) return "mopo";

  return normalized;
}

function getCountryFromLocation(value: string | null | undefined) {
  const parts = (value ?? "")
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);

  return parts.length > 1 ? parts[parts.length - 1] : "";
}

async function getAllActiveListingStatsRows(admin: SupabaseClient) {
  const rows: ListingStatsRow[] = [];
  const chunkSize = 1000;

  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await admin
      .from("listings")
      .select("seller_id,location,vehicle_type")
      .eq("is_sold", false)
      .eq("is_hidden", false)
      .range(from, from + chunkSize - 1)
      .returns<ListingStatsRow[]>();

    if (error) return { data: rows, error };
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < chunkSize) break;
  }

  return { data: rows, error: null };
}

async function getProfileCountries(admin: SupabaseClient, sellerIds: string[]) {
  const countries = new Map<string, string>();
  const chunkSize = 1000;

  for (let from = 0; from < sellerIds.length; from += chunkSize) {
    const chunk = sellerIds.slice(from, from + chunkSize);
    const { data, error } = await admin
      .from("profiles")
      .select("id,country")
      .in("id", chunk)
      .returns<ProfileCountryRow[]>();

    if (error) return { data: countries, error };

    for (const profile of data ?? []) {
      const country = normalizeText(profile.country);
      if (country) countries.set(profile.id, country);
    }
  }

  return { data: countries, error: null };
}

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const [profilesResult, listingsCountResult, listingRowsResult] = await Promise.all([
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      admin
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("is_sold", false)
        .eq("is_hidden", false),
      getAllActiveListingStatsRows(admin)
    ]);

    const firstError =
      profilesResult.error ??
      listingsCountResult.error ??
      listingRowsResult.error;

    if (firstError) {
      return NextResponse.json(
        { error: firstError.message ?? "Tilastojen lataus epäonnistui." },
        { status: 500 }
      );
    }

    const rows = listingRowsResult.data ?? [];
    const sellerIds = Array.from(new Set(rows.map((row) => row.seller_id).filter(Boolean))) as string[];
    const profileCountriesResult = await getProfileCountries(admin, sellerIds);

    if (profileCountriesResult.error) {
      return NextResponse.json(
        { error: profileCountriesResult.error.message ?? "Tilastojen lataus epaonnistui." },
        { status: 500 }
      );
    }

    const sellers = new Set(sellerIds);
    const locations = new Set(rows.map((row) => normalizeText(row.location)).filter(Boolean));
    const countries = new Set(
      rows
        .map((row) =>
          row.seller_id
            ? profileCountriesResult.data.get(row.seller_id) || getCountryFromLocation(row.location)
            : getCountryFromLocation(row.location)
        )
        .filter(Boolean)
    );
    const vehicleClasses = new Set(rows.map((row) => normalizeVehicleType(row.vehicle_type)).filter(Boolean));

    return NextResponse.json(
      {
        registeredUsers: profilesResult.count ?? 0,
        activeListings: listingsCountResult.count ?? 0,
        activeSellers: sellers.size,
        listingLocations: locations.size,
        listingCountries: countries.size,
        vehicleClasses: vehicleClasses.size || 4
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Tilastojen lataus epäonnistui."
      },
      { status: 500 }
    );
  }
}
