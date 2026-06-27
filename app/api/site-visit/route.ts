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

type SiteVisitBody = {
  path?: string | null;
  userAgent?: string | null;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : null;
}

function normalizeIp(value: string | null) {
  const ip = value?.trim();
  if (!ip) return null;
  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

function getForwardedIp(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => normalizeIp(part))
    .find(Boolean);

  return normalizeIp(
    forwarded ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("true-client-ip") ||
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-client-ip") ||
    (/^(localhost|127\.0\.0\.1|\[::1\])/.test(request.headers.get("host") ?? "")
      ? "127.0.0.1"
      : null)
  );
}

export async function POST(request: Request) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const body = await request.json().catch(() => ({})) as SiteVisitBody;
  const ip = getForwardedIp(request);
  const path = cleanText(body.path, 500);
  const userAgent = cleanText(body.userAgent ?? request.headers.get("user-agent"), 500);
  const token = getBearerToken(request);

  if (!ip) {
    return NextResponse.json({ ok: true });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  await admin
    .from("site_visits")
    .insert({
      ip,
      path,
      user_agent: userAgent
    });

  if (!token) {
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
