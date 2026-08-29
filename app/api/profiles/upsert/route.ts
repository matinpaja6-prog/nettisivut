import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { cleanOptionalUserText, cleanUserText } from "@/lib/text-input";

type ProfileUpsertBody = {
  profile?: {
    id?: string;
    account_type?: "private" | "company";
    first_name?: string;
    last_name?: string;
    company_name?: string | null;
    business_id?: string | null;
    company_website?: string | null;
    billing_email?: string | null;
    email?: string;
    phone?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  };
};

function cleanProfileInput(profile: NonNullable<ProfileUpsertBody["profile"]>) {
  return {
    account_type: profile.account_type === "company" ? "company" as const : "private" as const,
    first_name: cleanUserText(profile.first_name, 80),
    last_name: cleanUserText(profile.last_name, 80),
    company_name: cleanOptionalUserText(profile.company_name, 160),
    business_id: cleanOptionalUserText(profile.business_id, 80),
    company_website: cleanOptionalUserText(profile.company_website, 240),
    billing_email: cleanOptionalUserText(profile.billing_email, 180),
    email: cleanUserText(profile.email, 180),
    phone: cleanOptionalUserText(profile.phone, 40),
    address: cleanOptionalUserText(profile.address, 180),
    postal_code: cleanOptionalUserText(profile.postal_code, 40),
    city: cleanOptionalUserText(profile.city, 100),
    country: cleanUserText(profile.country, 100)
  };
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Supabase ei ole konfiguroitu." },
        { status: 500 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: "Kirjautuminen puuttuu." },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);
    const userId = userData.user?.id ?? "";

    if (userError || !userId) {
      return NextResponse.json(
        { error: "Kirjautuminen ei ole voimassa." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({})) as ProfileUpsertBody;
    const profile = body.profile;

    if (!profile || profile.id !== userId) {
      return NextResponse.json(
        { error: "Profiilin kayttaja ei tasmaa kirjautuneeseen kayttajaan." },
        { status: 403 }
      );
    }

    const cleanProfile = cleanProfileInput(profile);
    const admin = getSupabaseAdmin();
    const verifiedEmail = cleanUserText(
      userData.user?.email ?? profile.email,
      180
    );

    const contactName =
      `${cleanProfile.first_name ?? ""} ${cleanProfile.last_name ?? ""}`
        .replace(/\s+/g, " ")
        .trim();
    const fullName =
      cleanProfile.account_type === "company" && cleanProfile.company_name
        ? cleanProfile.company_name.trim()
        : contactName;

    const { data: existingProfile, error: existingError } =
      await admin
        .from("profiles")
        .select("public_id")
        .eq("id", userId)
        .maybeSingle<{ public_id: string | null }>();

    if (existingError) {
      console.error("Profile lookup failed", existingError);
      return NextResponse.json(
        { error: "Profiilin tallennus epäonnistui." },
        { status: 500 }
      );
    }

    const { data, error } =
      await admin
        .from("profiles")
        .upsert({
          ...cleanProfile,
          id: userId,
          email: verifiedEmail,
          public_id: existingProfile?.public_id || `KP${Date.now()}`,
          full_name: fullName,
          name: fullName,
          preferred_locale:
            userData.user?.user_metadata?.locale === "en" ||
            userData.user?.user_metadata?.locale === "sv" ||
            userData.user?.user_metadata?.locale === "no"
              ? userData.user.user_metadata.locale
              : "fi",
          is_completed: true
        })
        .select()
        .single();

    if (error) {
      console.error("Profile upsert failed", error);
      return NextResponse.json(
        { error: "Profiilin tallennus epäonnistui." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        ...data,
        full_name: fullName
      }
    });
  } catch (error) {
    console.error("Profile upsert failed", error);
    return NextResponse.json(
      { error: "Profiilin tallennus epäonnistui." },
      { status: 500 }
    );
  }
}
