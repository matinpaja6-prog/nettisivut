import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getOptionalUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function requireUser(request: Request) {
  const user = await getOptionalUser(request);
  if (!user) throw new Error("Kirjautuminen puuttuu.");
  return user;
}

async function resolveProfileId(profileId: string) {
  const admin = getSupabaseAdmin();
  const query = admin
    .from("profiles")
    .select("id")
    .limit(1);

  const { data, error } = uuidPattern.test(profileId)
    ? await query.eq("id", profileId).maybeSingle<{ id: string }>()
    : await query.eq("public_id", profileId).maybeSingle<{ id: string }>();

  if (error) throw error;
  return data?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawProfileId = searchParams.get("profileId") ?? "";
    const profileId = await resolveProfileId(rawProfileId);

    if (!profileId) {
      return NextResponse.json({
        follower_count: 0,
        following_count: 0,
        is_following: false
      });
    }

    const admin = getSupabaseAdmin();
    const user = await getOptionalUser(request);

    const [followers, following, isFollowing] = await Promise.all([
      admin
        .from("profile_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("followed_id", profileId),
      admin
        .from("profile_follows")
        .select("followed_id", { count: "exact", head: true })
        .eq("follower_id", profileId),
      user
        ? admin
            .from("profile_follows")
            .select("follower_id", { count: "exact", head: true })
            .eq("follower_id", user.id)
            .eq("followed_id", profileId)
        : Promise.resolve({ count: 0 })
    ]);

    return NextResponse.json({
      follower_count: followers.count ?? 0,
      following_count: following.count ?? 0,
      is_following: Boolean((isFollowing.count ?? 0) > 0)
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Seurantatietojen haku epäonnistui.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const profileId = await resolveProfileId(String(body.profileId ?? ""));

    if (!profileId) return jsonError("Profiilia ei löytynyt.", 404);
    if (profileId === user.id) return jsonError("Et voi seurata omaa profiiliasi.", 400);

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("profile_follows")
      .upsert(
        {
          follower_id: user.id,
          followed_id: profileId
        },
        {
          onConflict: "follower_id,followed_id"
        }
      );

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, profileId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Seurannan tallennus epäonnistui.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const profileId = await resolveProfileId(String(body.profileId ?? ""));

    if (!profileId) return jsonError("Profiilia ei löytynyt.", 404);

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("profile_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followed_id", profileId);

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, profileId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Seurannan poistaminen epäonnistui.", 500);
  }
}
