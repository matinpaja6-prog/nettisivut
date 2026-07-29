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
