const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export function slugifyProfileName(value?: string | null) {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || null;
}

export function listingPath(id?: string | number | null) {
  return `/ilmoitukset/${encodeURIComponent(String(id ?? ""))}`;
}

export function profilePath(id?: string | null, name?: string | null) {
  const slug = slugifyProfileName(name);
  const fallback = id ? String(id) : "";

  if (slug) {
    return `/profiili/${encodeURIComponent(slug)}`;
  }

  return `/profiili/${encodeURIComponent(fallback)}`;
}

export function legacySellerPath(id?: string | null) {
  return `/seller/${encodeURIComponent(String(id ?? ""))}`;
}

export function isUuidLike(value: string) {
  return UUID_RE.test(value);
}
