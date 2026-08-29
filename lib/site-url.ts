const DEFAULT_SITE_URL = "https://maskines.com";

function resolvePublicSiteUrl(value?: string) {
  const configuredUrl = value?.trim().replace(/\/+$/, "");

  if (!configuredUrl) return DEFAULT_SITE_URL;

  try {
    const url = new URL(configuredUrl);
    const hostname = url.hostname.toLowerCase();
    const isPlaceholder =
      hostname === "your-site.fi" ||
      hostname === "www.your-site.fi" ||
      hostname === "example.com" ||
      hostname === "www.example.com";

    return ["http:", "https:"].includes(url.protocol) && !isPlaceholder
      ? url.origin
      : DEFAULT_SITE_URL;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const PUBLIC_SITE_URL = resolvePublicSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL
);

export function absoluteSiteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${PUBLIC_SITE_URL}${normalizedPath}`;
}

export function absoluteStripeConnectUrl(path = "/") {
  const configuredBase = process.env.STRIPE_CONNECT_RETURN_BASE_URL?.trim().replace(/\/+$/, "")
    || PUBLIC_SITE_URL;
  let base: URL;

  try {
    base = new URL(configuredBase);
  } catch {
    throw new Error("Stripe Connectin paluuosoite ei ole kelvollinen URL-osoite.");
  }

  const liveMode = process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") === true;
  if (liveMode && base.protocol !== "https:") {
    throw new Error(
      "Stripe live -tila vaatii HTTPS-paluuosoitteen. Aseta STRIPE_CONNECT_RETURN_BASE_URL esimerkiksi arvoon https://maskines.com."
    );
  }
  if (!new Set(["http:", "https:"]).has(base.protocol)) {
    throw new Error("Stripe Connectin paluuosoitteen pitää alkaa http:// tai https://.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base.origin}${normalizedPath}`;
}
