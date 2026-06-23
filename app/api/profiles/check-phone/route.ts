import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CheckPhoneBody = {
  phone?: string;
};

function normalizePhone(value: string | null | undefined) {
  const compact =
    (value ?? "")
      .trim()
      .replace(/[^0-9+]/g, "");

  if (!compact) return "";
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `+358${compact.slice(1)}`;

  return `+358${compact}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as CheckPhoneBody;
    const phone = (body.phone ?? "").trim();
    const normalizedPhone = normalizePhone(phone);

    if (!phone || !normalizedPhone) {
      return NextResponse.json({ available: false, error: "Puhelinnumero puuttuu." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const phoneCandidates = Array.from(new Set([phone, normalizedPhone]));

    const { data: profile, error: profileError } =
      await admin
        .from("profiles")
        .select("id")
        .in("phone", phoneCandidates)
        .limit(1)
        .maybeSingle<{ id: string }>();

    if (profileError) {
      return NextResponse.json({ available: false, error: profileError.message }, { status: 500 });
    }

    if (profile) {
      return NextResponse.json({ available: false, reason: "in_use" });
    }

    const { data: reserved, error: reservedError } =
      await admin
        .from("reserved_phone_numbers")
        .select("id")
        .eq("normalized_phone", normalizedPhone)
        .gt("reserved_until", new Date().toISOString())
        .limit(1)
        .maybeSingle<{ id: string }>();

    if (reservedError && !reservedError.message.includes("reserved_phone_numbers")) {
      return NextResponse.json({ available: false, error: reservedError.message }, { status: 500 });
    }

    if (reserved) {
      return NextResponse.json({ available: false, reason: "reserved" });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    return NextResponse.json(
      {
        available: false,
        error:
          error instanceof Error
            ? error.message
            : "Puhelinnumeron tarkistus epaonnistui."
      },
      { status: 500 }
    );
  }
}
