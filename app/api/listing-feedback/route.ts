import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

type FeedbackBody = {
  listingId?: unknown;
  categoryRating?: unknown;
  detailsRating?: unknown;
  photosRating?: unknown;
  overallRating?: unknown;
  comment?: unknown;
  skipped?: unknown;
  listingMode?: unknown;
  vehicleType?: unknown;
  category?: unknown;
  subcategory?: unknown;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" && token ? token : null;
}

function getClient(key: string) {
  return createClient(supabaseUrl!, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function requireUser(request: Request) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      error: NextResponse.json(
        { error: "Supabase-asetukset puuttuvat." },
        { status: 500 }
      )
    };
  }

  const token = getBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: "Kirjautuminen puuttuu." }, { status: 401 })
    };
  }

  const authClient = getClient(anonKey);
  const { data, error } = await authClient.auth.getUser(token);
  const userId = data.user?.id;

  if (error || !userId) {
    return {
      error: NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 })
    };
  }

  return {
    admin: getClient(serviceRoleKey),
    userId
  };
}

function rating(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 1 && numberValue <= 5
    ? numberValue
    : null;
}

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: Request) {
  const guard = await requireUser(request);
  if ("error" in guard) return guard.error;

  try {
    const { data, error } = await guard.admin
      .from("listing_creation_feedback")
      .select("id")
      .eq("user_id", guard.userId)
      .maybeSingle<{ id: string }>();

    if (error) throw error;

    return NextResponse.json(
      { hasFeedback: Boolean(data?.id) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Palautteen tarkistus epäonnistui." },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireUser(request);
  if ("error" in guard) return guard.error;

  try {
    const body = (await request.json().catch(() => ({}))) as FeedbackBody;
    const skipped = body.skipped === true;
    const payload = {
      user_id: guard.userId,
      listing_id: text(body.listingId, 80) || null,
      category_rating: skipped ? null : rating(body.categoryRating),
      details_rating: skipped ? null : rating(body.detailsRating),
      photos_rating: skipped ? null : rating(body.photosRating),
      overall_rating: skipped ? null : rating(body.overallRating),
      comment: text(body.comment, 700) || null,
      skipped,
      listing_mode: text(body.listingMode, 30) || null,
      vehicle_type: text(body.vehicleType, 80) || null,
      category: text(body.category, 120) || null,
      subcategory: text(body.subcategory, 120) || null
    };

    if (!skipped && !payload.overall_rating) {
      return NextResponse.json({ error: "Anna kokonaisarvio." }, { status: 400 });
    }

    const { error } = await guard.admin
      .from("listing_creation_feedback")
      .upsert(payload, { onConflict: "user_id" });

    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Palautteen tallennus epäonnistui." },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
