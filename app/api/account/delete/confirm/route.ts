import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

type UserPhoneRow = {
  phone: string | null;
};

type CompanySellerPhoneRow = {
  phone: string | null;
};

function getAuthClient() {
  if (!supabaseUrl || !anonKey) return null;

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(" ");

  if (type.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function normalizePhone(value: string | null | undefined) {
  const compact =
    (value ?? "")
      .trim()
      .replace(/[\s().-]/g, "");

  if (!compact) return "";
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `+358${compact.slice(1)}`;

  return `+358${compact}`;
}

export async function POST(request: Request) {
  const auth = getAuthClient();
  const admin = getAdminClient();

  if (!auth || !admin) {
    const missing = [
      !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : "",
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY tai NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : "",
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""
    ].filter(Boolean);

    return NextResponse.json(
      { error: `Supabase-palvelinasetukset puuttuvat: ${missing.join(", ")}.` },
      { status: 500 }
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Kirjaudu sisään ennen tilin poistamista." },
      { status: 401 }
    );
  }

  const { data: userData, error: userError } =
    await auth.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Istuntoa ei voitu vahvistaa." },
      { status: 401 }
    );
  }

  const user = userData.user;

  const reservedUntil =
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profile } =
    await admin
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle<UserPhoneRow>();

  const { data: sellerPhones } =
    await admin
      .from("company_sellers")
      .select("phone")
      .eq("company_id", user.id)
      .returns<CompanySellerPhoneRow[]>();

  const phones =
    Array.from(
      new Set(
        [profile?.phone, ...(sellerPhones ?? []).map((seller) => seller.phone)]
          .map(normalizePhone)
          .filter(Boolean)
      )
    );

  if (phones.length > 0) {
    const { error: reserveError } =
      await admin
        .from("reserved_phone_numbers")
        .insert(
          phones.map((phone) => ({
            phone,
            normalized_phone: phone,
            user_id: user.id,
            reserved_until: reservedUntil
          }))
        );

    if (reserveError) {
      return NextResponse.json(
        {
          error:
            reserveError.message.includes("reserved_phone_numbers")
              ? "Aja ensin Supabasessa account-deletion.sql."
              : reserveError.message
        },
        { status: 500 }
      );
    }
  }

  const { error: deleteError } =
    await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true
  });
}
