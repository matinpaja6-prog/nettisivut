import { NextResponse } from "next/server";
import { requireUserFromRequest } from "@/lib/supabase-admin";

type PhoneUpdateBody = {
  phone?: string;
};

function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+358${digits.slice(1)}`;
  if (digits.startsWith("358")) return `+${digits}`;

  return `+358${digits}`;
}

function getPhoneUpdateError(message: string) {
  if (message.includes("phone_reserved_until_3_months")) {
    return "Tämä puhelinnumero on varattu poistetulle tilille 3 kuukaudeksi.";
  }

  if (message.includes("profiles_phone_unique") || message.includes("unique constraint")) {
    return "Tämä puhelinnumero on jo käytössä toisella tilillä.";
  }

  return "Puhelinnumeron tallennus epäonnistui.";
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requireUserFromRequest(request);
    const body = await request.json().catch(() => ({})) as PhoneUpdateBody;
    const phone = normalizePhoneNumber(typeof body.phone === "string" ? body.phone : "");

    if (!phone || phone.length < 8 || phone.length > 16) {
      return NextResponse.json(
        { error: "Syötä kelvollinen puhelinnumero." },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("profiles")
      .update({ phone })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Profile phone update failed", error);
      return NextResponse.json(
        { error: getPhoneUpdateError(error.message) },
        { status: 400 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const unauthorized = message.includes("Kirjautuminen");

    if (!unauthorized) console.error("Profile phone update failed", error);

    return NextResponse.json(
      { error: unauthorized ? message : "Puhelinnumeron tallennus epäonnistui." },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
