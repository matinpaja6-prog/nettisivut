import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
    birth_date?: string | null;
  };
};

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

    const contactName =
      `${profile.first_name ?? ""} ${profile.last_name ?? ""}`
        .replace(/\s+/g, " ")
        .trim();
    const fullName =
      profile.account_type === "company" && profile.company_name
        ? profile.company_name.trim()
        : contactName;

    const { data: existingProfile, error: existingError } =
      await supabase
        .from("profiles")
        .select("public_id")
        .eq("id", userId)
        .maybeSingle<{ public_id: string | null }>();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    const { data, error } =
      await supabase
        .from("profiles")
        .upsert({
          ...profile,
          public_id: existingProfile?.public_id || `KP${Date.now()}`,
          full_name: fullName,
          name: fullName,
          is_completed: true
        })
        .select()
        .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Profiilin tallennus epaonnistui."
      },
      { status: 500 }
    );
  }
}
