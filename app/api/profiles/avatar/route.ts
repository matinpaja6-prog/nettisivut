import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AvatarUpdateBody = {
  avatarUrl?: string | null;
};

const AVATAR_FILE_NAME = /^avatar(?:-[a-zA-Z0-9-]+)?\.(?:jpe?g|png|webp)$/i;

function getOwnedAvatarPath(
  avatarUrl: string,
  supabaseUrl: string,
  userId: string
): string | null {
  try {
    const parsedUrl = new URL(avatarUrl);
    const expectedOrigin = new URL(supabaseUrl).origin;
    const expectedPathPrefix = `/storage/v1/object/public/avatars/${userId}/`;

    if (
      parsedUrl.origin !== expectedOrigin ||
      !parsedUrl.pathname.startsWith(expectedPathPrefix)
    ) {
      return null;
    }

    const fileName = decodeURIComponent(
      parsedUrl.pathname.slice(expectedPathPrefix.length)
    );

    return AVATAR_FILE_NAME.test(fileName) ? `${userId}/${fileName}` : null;
  } catch {
    return null;
  }
}

export async function PATCH(request: Request) {
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
      return NextResponse.json({ error: "Supabase ei ole konfiguroitu." }, { status: 500 });
    }

    if (!token) {
      return NextResponse.json({ error: "Kirjautuminen puuttuu." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const userId = userData.user?.id ?? "";

    if (userError || !userId) {
      return NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as AvatarUpdateBody;
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : null;

    const newAvatarPath = avatarUrl
      ? getOwnedAvatarPath(avatarUrl, supabaseUrl, userId)
      : null;

    if (avatarUrl && !newAvatarPath) {
      return NextResponse.json({ error: "Profiilikuvan osoite ei kuulu käyttäjälle." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: currentProfile, error: currentProfileError } = await admin
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .single<{ avatar_url: string | null }>();

    if (currentProfileError) {
      console.error("Current profile avatar lookup failed", currentProfileError);
      return NextResponse.json({ error: "Profiilikuvan tallennus epäonnistui." }, { status: 500 });
    }

    const previousAvatarPath = currentProfile.avatar_url
      ? getOwnedAvatarPath(currentProfile.avatar_url, supabaseUrl, userId)
      : null;

    const { data, error } = await admin
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId)
      .select("avatar_url")
      .single<{ avatar_url: string | null }>();

    if (error) {
      console.error("Profile avatar update failed", error);

      // The browser has already uploaded the new object. Remove it if the
      // database update failed so failed changes do not leave orphaned files.
      if (newAvatarPath && newAvatarPath !== previousAvatarPath) {
        const { error: cleanupError } = await admin.storage
          .from("avatars")
          .remove([newAvatarPath]);
        if (cleanupError) {
          console.error("Failed avatar upload cleanup failed", cleanupError);
        }
      }

      return NextResponse.json({ error: "Profiilikuvan tallennus epäonnistui." }, { status: 500 });
    }

    // Keep at most the avatar now referenced by the profile. This removes the
    // directly previous image as well as files orphaned by the old upload flow.
    const avatarStorage = admin.storage.from("avatars");
    const { data: storedFiles, error: listError } = await avatarStorage.list(userId, {
      limit: 1000
    });
    let obsoletePaths: string[] = [];

    if (listError) {
      console.error("Old profile avatar listing failed", listError);
      if (previousAvatarPath && previousAvatarPath !== newAvatarPath) {
        obsoletePaths = [previousAvatarPath];
      }
    } else {
      obsoletePaths = (storedFiles ?? [])
        .filter(file => AVATAR_FILE_NAME.test(file.name))
        .map(file => `${userId}/${file.name}`)
        .filter(path => path !== newAvatarPath);
    }

    if (obsoletePaths.length > 0) {
      const { error: removeError } = await avatarStorage.remove(obsoletePaths);
      if (removeError) {
        console.error("Old profile avatar removal failed", removeError);
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Profile avatar update failed", error);
    return NextResponse.json({ error: "Profiilikuvan tallennus epäonnistui." }, { status: 500 });
  }
}
