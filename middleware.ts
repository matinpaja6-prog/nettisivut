import { NextRequest, NextResponse } from "next/server";
import {
  canonicalPathFromLocalized,
  localizedPathFromCanonical,
  normalizeRouteLocale
} from "@/lib/routes";

const PUBLIC_FILE =
  /\.(?:avif|bmp|css|csv|eot|gif|ico|jpe?g|js|json|map|mp3|mp4|ogg|otf|pdf|png|svg|txt|webmanifest|webm|webp|woff2?|xml)$/i;
const CROSS_ORIGIN_BRAND_ASSETS = new Set([
  "/maskines-email-brand-v2.png",
  "/maskines-brand-mark-v3.png",
  "/maskines-brand-mark-dark-v3.png",
  "/maskines-icon-v2.png",
  "/maskines-brand-share-v2.png"
]);
const CANONICAL_HOST = "maskines.com";
const LEGACY_HOSTS = new Set(["maskinet.com", "www.maskinet.com"]);
const TRUSTED_MUTATION_ORIGINS = new Set([
  `https://${CANONICAL_HOST}`,
  `https://www.${CANONICAL_HOST}`
]);
const API_RATE_LIMIT_WINDOW_MS = 60_000;
const API_MAX_BODY_BYTES = 128_000;
const MESSAGE_IMAGE_MAX_BODY_BYTES = 750_000;
const PRODUCT_IMAGE_MAX_BODY_BYTES = 32_000_000;
const apiRateLimitCache = new Map<string, { count: number; resetAt: number }>();
const PRIVATE_NOINDEX_PREFIXES = [
  "/admin",
  "/auth",
  "/messages",
  "/settings",
  "/profile",
  "/my-listings",
  "/garage",
  "/saved",
  "/followed",
  "/sell",
  "/search-alerts",
  "/yritys",
  "/ostoskori",
  "/tilaus",
  "/tilaukset"
];
const ALLOWED_HTTP_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
  "POST",
  "PUT",
  "PATCH",
  "DELETE"
]);
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://maps.googleapis.com https://challenges.cloudflare.com https://js.stripe.com https://checkout.stripe.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://*.googleapis.com https://api.stripe.com https://checkout.stripe.com https://*.stripe.com",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src https://challenges.cloudflare.com https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com https://*.stripe.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : [])
].join("; ");
const SENSITIVE_PATH_PATTERN =
  /(?:^|\/)(?:\.(?!well-known\/)|\.env|\.git|\.svn|\.hg|node_modules|supabase|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig(?:\..*)?\.json|next\.config\.(?:js|mjs|ts)|middleware\.ts|Dockerfile|docker-compose\.ya?ml)(?:$|\/)/i;
const SENSITIVE_FILE_PATTERN =
  /\.(?:env|local|log|bak|backup|old|orig|sql|sqlite|sqlite3|db|pem|key|crt|p12|pfx|map)$/i;
const PUBLIC_LISTING_SEGMENTS = new Set([
  "listing",
  "listings",
  "ilmoitus",
  "ilmoitukset",
  "ad",
  "annons",
  "annonse",
  "annonser"
]);

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
    CONTENT_SECURITY_POLICY
  );
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\" \"https://checkout.stripe.com\"), usb=(), interest-cohort=()"
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return response;
}

function applyDocumentHeaders(
  response: NextResponse,
  options: { noIndex?: boolean } = {}
) {
  applySecurityHeaders(response);
  if (options.noIndex) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, max-age=0, must-revalidate"
    );
    response.headers.set("CDN-Cache-Control", "no-store");
    response.headers.set("Surrogate-Control", "no-store");
    return response;
  }

  response.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=300, stale-while-revalidate=3600"
  );
  response.headers.set(
    "CDN-Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=3600"
  );
  return response;
}

function shouldNoIndex(pathname: string) {
  return PRIVATE_NOINDEX_PREFIXES.some((prefix) =>
    prefix === "/profile"
      ? pathname === prefix
      : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

function isCrossSiteMutation(request: NextRequest) {
  if (!isUnsafeMethod(request.method)) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestOrigins = new Set<string>([
      request.nextUrl.origin,
      ...TRUSTED_MUTATION_ORIGINS
    ]);
    const forwardedProtocol =
      firstForwardedValue(request.headers.get("x-forwarded-proto")) ||
      request.nextUrl.protocol.replace(":", "");
    const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
    const host = firstForwardedValue(request.headers.get("host"));

    if (forwardedHost) requestOrigins.add(`${forwardedProtocol}://${forwardedHost}`);
    if (host) requestOrigins.add(`${forwardedProtocol}://${host}`);

    return !requestOrigins.has(new URL(origin).origin);
  } catch {
    return true;
  }
}

function getApiRateLimit(pathname: string, method: string) {
  if (pathname.startsWith("/api/commerce/stripe/webhook")) return 600;
  if (pathname.startsWith("/api/google-maps-script")) return 30;
  if (!isUnsafeMethod(method)) return 180;
  if (pathname.startsWith("/api/account/delete")) return 3;
  if (pathname.startsWith("/api/auth/email")) return 5;
  if (pathname.startsWith("/api/auth/login")) return 10;
  if (pathname.startsWith("/api/admin")) return 20;
  if (pathname.startsWith("/api/contact")) return 5;
  if (pathname.startsWith("/api/profiles/check-phone")) return 8;
  if (pathname.startsWith("/api/profiles/upsert")) return 10;
  if (pathname.startsWith("/api/search-alerts/notify")) return 8;
  if (pathname.startsWith("/api/site-visit")) return 20;
  if (pathname.startsWith("/api/moderate-listing")) return 12;
  if (pathname.startsWith("/api/translate-listing")) return 4;
  if (pathname.startsWith("/api/translate-ui")) return 15;
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

function listingRouteIdentifier(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || !PUBLIC_LISTING_SEGMENTS.has(segments[0])) {
    return null;
  }

  try {
    return decodeURIComponent(segments[1]).trim() || null;
  } catch {
    return null;
  }
}

async function publicListingExists(identifier: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publicKey) return null;

  const numeric = identifier.match(/^id(\d+)$/i)?.[1] ??
    (/^\d+$/.test(identifier) ? identifier : "");
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  if (!numeric && !isUuid) return null;

  const filter = numeric
    ? `listing_number=eq.${encodeURIComponent(numeric)}`
    : `id=eq.${encodeURIComponent(identifier)}`;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/listings?select=id,is_hidden,is_sold&${filter}&limit=1`,
      {
        headers: {
          apikey: publicKey,
          authorization: `Bearer ${publicKey}`
        },
        cache: "no-store",
        signal: AbortSignal.timeout(1_500)
      }
    );

    if (!response.ok) return null;
    const rows = await response.json() as Array<{
      id: string;
      is_hidden?: boolean | null;
      is_sold?: boolean | null;
    }>;
    const listing = rows[0];
    return Boolean(listing && !listing.is_hidden && !listing.is_sold);
  } catch {
    // A temporary database failure must not turn live listings into 410 pages.
    return null;
  }
}

function removedListingResponse() {
  const response = new NextResponse("Ilmoitus on poistettu.", {
    status: 410,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
  return applySecurityHeaders(response);
}

function getClientIp(request: NextRequest) {
  const forwardedChain = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const candidate =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("true-client-ip") ||
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-real-ip") ||
    forwardedChain?.[0] ||
    request.headers.get("x-client-ip") ||
    null;

  if (!candidate) return null;
  return candidate
    .trim()
    .replace(/^\[|\]$/g, "")
    .replace(/^::ffff:/i, "");
}

async function isIpBanned(ip: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY;

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
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  if (!ALLOWED_HTTP_METHODS.has(method)) {
    const response = new NextResponse(null, { status: 405 });
    response.headers.set("Allow", [...ALLOWED_HTTP_METHODS].join(", "));
    return applySecurityHeaders(response);
  }

  if (isSensitivePath(pathname)) {
    return applySecurityHeaders(new NextResponse(null, { status: 404 }));
  }

  const normalizedHostname = hostname.toLowerCase();

  if (LEGACY_HOSTS.has(normalizedHostname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = CANONICAL_HOST;
    redirectUrl.protocol = "https:";
    return applyDocumentHeaders(NextResponse.redirect(redirectUrl, 308));
  }

  const ip = getClientIp(request);

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE.test(pathname)
  ) {
    const response = applySecurityHeaders(NextResponse.next());
    if (CROSS_ORIGIN_BRAND_ASSETS.has(pathname)) {
      response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    }
    return response;
  }

  // Keep the administration route reachable so an administrator can remove
  // an accidental IP ban. Every other document and API route is denied.
  const isAdminRecoveryRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/");

  if (ip && !isAdminRecoveryRoute && await isIpBanned(ip)) {
    if (pathname.startsWith("/api")) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Pääsy estetty." }, { status: 403 })
      );
    }

    return applySecurityHeaders(
      new NextResponse("Pääsy estetty.", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      })
    );
  }

  const listingIdentifier = listingRouteIdentifier(pathname);
  if (listingIdentifier) {
    const exists = await publicListingExists(listingIdentifier);
    if (exists === false) {
      return removedListingResponse();
    }
  }

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth")
  ) {
    return applyDocumentHeaders(NextResponse.next(), { noIndex: true });
  }

  if (pathname.startsWith("/api")) {
    if (isCrossSiteMutation(request)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Pyyntö estettiin." }, { status: 403 })
      );
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    const maxBodyBytes = pathname === "/api/messages/send"
      ? MESSAGE_IMAGE_MAX_BODY_BYTES
      : pathname === "/api/commerce/products/images"
        ? PRODUCT_IMAGE_MAX_BODY_BYTES
        : API_MAX_BODY_BYTES;
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Pyyntö on liian suuri." }, { status: 413 })
      );
    }

    if (isUnsafeMethod(method) && contentLength > 0) {
      const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
      if (
        !contentType.startsWith("application/json") &&
        !contentType.startsWith("multipart/form-data")
      ) {
        return applySecurityHeaders(
          NextResponse.json({ error: "Sisältötyyppiä ei tueta." }, { status: 415 })
        );
      }
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

  const locale = normalizeRouteLocale(request.cookies.get("locale")?.value);
  const canonicalPath = canonicalPathFromLocalized(pathname);
  const localizedPath = localizedPathFromCanonical(canonicalPath, locale);
  const noIndex = shouldNoIndex(canonicalPath);

  if (pathname === canonicalPath && localizedPath !== pathname) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizedPath;
    return applyDocumentHeaders(NextResponse.redirect(redirectUrl), { noIndex });
  }

  if (canonicalPath !== pathname) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = canonicalPath;
    return applyDocumentHeaders(NextResponse.rewrite(rewriteUrl), { noIndex });
  }

  return applyDocumentHeaders(NextResponse.next(), { noIndex });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
