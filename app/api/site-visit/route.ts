import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" && token ? token : null;
}

function getForwardedIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

export async function POST(request: Request) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const body = await request.json().catch(() => ({})) as { ip?: string | null };
  const ip = body.ip?.trim() || getForwardedIp(request);
  const token = getBearerToken(request);

  if (!ip || !token) {
    return NextResponse.json({ ok: true });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const userId = userData.user?.id;
  if (userError || !userId) {
    return NextResponse.json({ ok: true });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: current } = await admin
    .from("profiles")
    .select("last_ip,ip_count")
    .eq("id", userId)
    .maybeSingle<{ last_ip: string | null; ip_count: number | null }>();

  await admin
    .from("profiles")
    .update({
      last_ip: ip,
      last_seen_ip: ip,
      ip_count: current?.last_ip === ip
        ? (current?.ip_count ?? 0)
        : (current?.ip_count ?? 0) + 1
    })
    .eq("id", userId);

  return NextResponse.json({ ok: true });
}
