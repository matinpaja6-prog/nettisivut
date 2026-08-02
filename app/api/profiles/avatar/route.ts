import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AvatarUpdateBody = {
  avatarUrl?: string | null;
};

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

    if (avatarUrl) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(avatarUrl);
      } catch {
        return NextResponse.json({ error: "Profiilikuvan osoite ei kelpaa." }, { status: 400 });
      }

      const expectedOrigin = new URL(supabaseUrl).origin;
      const expectedPathPrefix = `/storage/v1/object/public/avatars/${userId}/`;
      const fileName = parsedUrl.pathname.slice(expectedPathPrefix.length);
      const isAvatarFile = /^avatar(?:-[a-zA-Z0-9-]+)?\.(?:jpe?g|png|webp)$/i.test(fileName);
      if (
        parsedUrl.origin !== expectedOrigin ||
        !parsedUrl.pathname.startsWith(expectedPathPrefix) ||
        !isAvatarFile
      ) {
        return NextResponse.json({ error: "Profiilikuvan osoite ei kuulu käyttäjälle." }, { status: 400 });
      }
    }

    const { data, error } = await getSupabaseAdmin()
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId)
      .select("avatar_url")
      .single<{ avatar_url: string | null }>();

    if (error) {
      console.error("Profile avatar update failed", error);
      return NextResponse.json({ error: "Profiilikuvan tallennus epäonnistui." }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Profile avatar update failed", error);
    return NextResponse.json({ error: "Profiilikuvan tallennus epäonnistui." }, { status: 500 });
  }
}
