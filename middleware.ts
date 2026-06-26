import { NextRequest, NextResponse } from "next/server";
import {
  canonicalPathFromLocalized,
  localizedPathFromCanonical,
  normalizeRouteLocale
} from "@/lib/routes";

const PUBLIC_FILE = /\.(.*)$/;
const IP_BAN_CACHE_TTL_MS = 60_000;
const ipBanCache = new Map<string, { banned: boolean; expiresAt: number }>();
const SENSITIVE_PATH_PATTERN =
  /(?:^|\/)(?:\.(?!well-known\/)|\.env|\.git|\.svn|\.hg|node_modules|supabase|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig(?:\..*)?\.json|next\.config\.(?:js|mjs|ts)|middleware\.ts|Dockerfile|docker-compose\.ya?ml)(?:$|\/)/i;
const SENSITIVE_FILE_PATTERN =
  /\.(?:env|local|log|bak|backup|old|orig|sql|sqlite|sqlite3|db|pem|key|crt|p12|pfx|map)$/i;

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function isSensitivePath(pathname: string) {
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return true;
  }

  return (
    SENSITIVE_PATH_PATTERN.test(decodedPathname) ||
    SENSITIVE_FILE_PATTERN.test(decodedPathname)
  );
}

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

  if (isSensitivePath(pathname)) {
    return applySecurityHeaders(new NextResponse(null, { status: 404 }));
  }

  if (hostname.toLowerCase() === "maskines.com") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = "www.maskines.com";
    redirectUrl.protocol = "https:";
    return applySecurityHeaders(NextResponse.redirect(redirectUrl, 308));
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/admin") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE.test(pathname)
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return applySecurityHeaders(response);
  }

  const ip = getClientIp(request);
  if (ip && await isIpBanned(ip)) {
    return applySecurityHeaders(new NextResponse("IP-osoite on estetty.", { status: 403 }));
  }

  const locale = normalizeRouteLocale(request.cookies.get("locale")?.value);
  const canonicalPath = canonicalPathFromLocalized(pathname);
  const localizedPath = localizedPathFromCanonical(canonicalPath, locale);

  if (pathname === canonicalPath && localizedPath !== pathname) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizedPath;
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  if (canonicalPath !== pathname) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = canonicalPath;
    return applySecurityHeaders(NextResponse.rewrite(rewriteUrl));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
