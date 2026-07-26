import { NextRequest, NextResponse } from "next/server";
import {
  canonicalPathFromLocalized,
  localizedPathFromCanonical,
  normalizeRouteLocale
} from "@/lib/routes";

const PUBLIC_FILE = /\.(.*)$/;
const CANONICAL_HOST = "maskines.com";
const LEGACY_HOSTS = new Set(["maskinet.com", "www.maskinet.com"]);
const IP_BAN_CACHE_TTL_MS = 60_000;
const ipBanCache = new Map<string, { banned: boolean; expiresAt: number }>();
const API_RATE_LIMIT_WINDOW_MS = 60_000;
const API_MAX_BODY_BYTES = 1_000_000;
const apiRateLimitCache = new Map<string, { count: number; resetAt: number }>();
const SENSITIVE_PATH_PATTERN =
  /(?:^|\/)(?:\.(?!well-known\/)|\.env|\.git|\.svn|\.hg|node_modules|supabase|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig(?:\..*)?\.json|next\.config\.(?:js|mjs|ts)|middleware\.ts|Dockerfile|docker-compose\.ya?ml)(?:$|\/)/i;
const SENSITIVE_FILE_PATTERN =
  /\.(?:env|local|log|bak|backup|old|orig|sql|sqlite|sqlite3|db|pem|key|crt|p12|pfx|map)$/i;

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  response.headers.set("Origin-Agent-Cluster", "?1");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set(
    "Content-Security-Policy",
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"
  );
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isCrossSiteMutation(request: NextRequest) {
  if (!isUnsafeMethod(request.method)) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin !== request.nextUrl.origin;
  } catch {
    return true;
  }
}

function getApiRateLimit(pathname: string, method: string) {
  if (!isUnsafeMethod(method)) return 180;
  if (
    pathname.startsWith("/api/contact") ||
    pathname.startsWith("/api/moderate-listing") ||
    pathname.startsWith("/api/translate-")
  ) {
    return 20;
  }
  return 60;
}

function isApiRateLimited(key: string, limit: number) {
  const now = Date.now();
  const current = apiRateLimitCache.get(key);

  if (!current || current.resetAt <= now) {
    apiRateLimitCache.set(key, {
      count: 1,
      resetAt: now + API_RATE_LIMIT_WINDOW_MS
    });
    return false;
  }

  current.count += 1;
  if (apiRateLimitCache.size > 5_000) apiRateLimitCache.clear();
  return current.count > limit;
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

  const normalizedHostname = hostname.toLowerCase();

  if (LEGACY_HOSTS.has(normalizedHostname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = CANONICAL_HOST;
    redirectUrl.protocol = "https:";
    return applySecurityHeaders(NextResponse.redirect(redirectUrl, 308));
  }

  const ip = getClientIp(request);

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE.test(pathname)
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api")) {
    if (ip && await isIpBanned(ip)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Pääsy estetty." }, { status: 403 })
      );
    }

    if (isCrossSiteMutation(request)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Pyyntö estettiin." }, { status: 403 })
      );
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > API_MAX_BODY_BYTES) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Pyyntö on liian suuri." }, { status: 413 })
      );
    }

    const rateLimitKey = `${ip || "unknown"}:${pathname}:${request.method}`;
    if (isApiRateLimited(rateLimitKey, getApiRateLimit(pathname, request.method))) {
      const response = NextResponse.json(
        { error: "Liian monta pyyntöä. Yritä hetken kuluttua uudelleen." },
        { status: 429 }
      );
      response.headers.set("Retry-After", "60");
      return applySecurityHeaders(response);
    }

    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return applySecurityHeaders(response);
  }

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
