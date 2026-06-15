import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function profileFollowErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return "Seurannan tallennus epÃ¤onnistui.";
  if (error.code === "42P01" || error.message?.includes("profile_follows")) {
    return "Seuranta ei ole vielÃ¤ kÃ¤ytÃ¶ssÃ¤: aja Supabasessa supabase/profile-follows.sql.";
  }
  return error.message ?? "Seurannan tallennus epÃ¤onnistui.";
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

async function getMyProfileFollows(request: Request) {
  const user = await requireUser(request);
  const admin = getSupabaseAdmin();

  const [followingResult, followersResult] = await Promise.all([
    admin
      .from("profile_follows")
      .select("followed_id, created_at")
      .eq("follower_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("profile_follows")
      .select("follower_id, created_at")
      .eq("followed_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  if (followingResult.error) throw followingResult.error;
  if (followersResult.error) throw followersResult.error;

  const following = followingResult.data ?? [];
  const followers = followersResult.data ?? [];
  const profileIds = Array.from(new Set([
    ...following.map((row) => row.followed_id),
    ...followers.map((row) => row.follower_id)
  ].filter(Boolean)));

  if (profileIds.length === 0) return [];

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, account_type, company_name, full_name, name, first_name, last_name, avatar_url, city, country, bio")
    .in("id", profileIds);

  if (error) throw error;

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const displayName = (profile: NonNullable<typeof profiles>[number] | undefined) =>
    profile?.company_name?.trim()
    || profile?.full_name?.trim()
    || profile?.name?.trim()
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim()
    || "Kayttaja";

  return [
    ...following.map((row) => {
      const profile = profileById.get(row.followed_id);
      return {
        direction: "following",
        profile_id: row.followed_id,
        account_type: profile?.account_type ?? null,
        display_name: displayName(profile),
        avatar_url: profile?.avatar_url ?? null,
        city: profile?.city ?? null,
        country: profile?.country ?? null,
        bio: profile?.bio ?? null,
        relation_created_at: row.created_at
      };
    }),
    ...followers.map((row) => {
      const profile = profileById.get(row.follower_id);
      return {
        direction: "follower",
        profile_id: row.follower_id,
        account_type: profile?.account_type ?? null,
        display_name: displayName(profile),
        avatar_url: profile?.avatar_url ?? null,
        city: profile?.city ?? null,
        country: profile?.country ?? null,
        bio: profile?.bio ?? null,
        relation_created_at: row.created_at
      };
    })
  ].sort((a, b) =>
    new Date(b.relation_created_at).getTime() - new Date(a.relation_created_at).getTime()
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("scope") === "mine") {
      return NextResponse.json(await getMyProfileFollows(request));
    }

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

    if (error) return jsonError(profileFollowErrorMessage(error), 500);
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

    if (error) return jsonError(profileFollowErrorMessage(error), 500);
    return NextResponse.json({ ok: true, profileId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Seurannan poistaminen epäonnistui.", 500);
  }
}
