import { NextRequest, NextResponse } from "next/server";
import {
  canonicalPathFromLocalized,
  localizedPathFromCanonical,
  normalizeRouteLocale
} from "@/lib/routes";

const PUBLIC_FILE = /\.(.*)$/;
const IP_BAN_CACHE_TTL_MS = 60_000;
const ipBanCache = new Map<string, { banned: boolean; expiresAt: number }>();

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

async function isIpBanned(ip: string) {
  const cached = ipBanCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.banned;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return false;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/banned_ips?ip=eq.${encodeURIComponent(ip)}&select=ip&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`
        },
        cache: "no-store",
        signal: AbortSignal.timeout(1500)
      }
    );

    if (!response.ok) return false;
    const rows = (await response.json()) as Array<{ ip: string }>;
    const banned = rows.length > 0;
    if (ipBanCache.size > 500) ipBanCache.clear();
    ipBanCache.set(ip, { banned, expiresAt: Date.now() + IP_BAN_CACHE_TTL_MS });
    return banned;
  } catch {
    ipBanCache.set(ip, { banned: false, expiresAt: Date.now() + 10_000 });
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;

  if (hostname.toLowerCase() === "maskines.com") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = "www.maskines.com";
    redirectUrl.protocol = "https:";
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  if (ip && await isIpBanned(ip)) {
    return new NextResponse("IP-osoite on estetty.", { status: 403 });
  }

  const locale = normalizeRouteLocale(request.cookies.get("locale")?.value);
  const canonicalPath = canonicalPathFromLocalized(pathname);
  const localizedPath = localizedPathFromCanonical(canonicalPath, locale);

  if (pathname === canonicalPath && localizedPath !== pathname) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizedPath;
    return NextResponse.redirect(redirectUrl);
  }

  if (canonicalPath !== pathname) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = canonicalPath;
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
