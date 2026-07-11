import { supabase } from "@/lib/supabase";

export type SiteAppearance = {
  hero_image_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  surface_color: string | null;
  text_color: string | null;
  muted_color: string | null;
  line_color: string | null;
  topbar_color: string | null;
  card_color: string | null;
  hero_overlay: string | null;
};

export const APPEARANCE_EVENT = "arctic-appearance-changed";
export const DEFAULT_LISTING_CARD_COLOR = "#071321";
const LEGACY_LISTING_CARD_COLORS = new Set([
  "#000000",
  "#020711",
  "#040d1f",
  "#050b13",
  "#06111d",
  "#08111d",
  "#0b1118",
  "#0e1721"
]);

export const DEFAULT_APPEARANCE: SiteAppearance = {
  hero_image_url: "/hero-bg.png",
  primary_color: "#ff7a1a",
  accent_color: "#ff9d2e",
  background_color: "#0b1118",
  surface_color: "#0e1721",
  text_color: "#f4f8fc",
  muted_color: "#9aaabe",
  line_color: "#1a2a3e",
  topbar_color: "#040d1f",
  card_color: DEFAULT_LISTING_CARD_COLOR,
  hero_overlay: "rgba(2, 10, 20, 0.55)"
};

export function normalizeCardColor(color: string | null | undefined) {
  if (!color) return DEFAULT_APPEARANCE.card_color;
  const normalized = color.trim().toLowerCase();
  return LEGACY_LISTING_CARD_COLORS.has(normalized) ? DEFAULT_LISTING_CARD_COLOR : color;
}

function mergeAppearance(raw: unknown): SiteAppearance {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<SiteAppearance>;
  return {
    hero_image_url: obj.hero_image_url ?? DEFAULT_APPEARANCE.hero_image_url,
    primary_color: obj.primary_color ?? DEFAULT_APPEARANCE.primary_color,
    accent_color: obj.accent_color ?? DEFAULT_APPEARANCE.accent_color,
    background_color: obj.background_color ?? DEFAULT_APPEARANCE.background_color,
    surface_color: obj.surface_color ?? DEFAULT_APPEARANCE.surface_color,
    text_color: obj.text_color ?? DEFAULT_APPEARANCE.text_color,
    muted_color: obj.muted_color ?? DEFAULT_APPEARANCE.muted_color,
    line_color: obj.line_color ?? DEFAULT_APPEARANCE.line_color,
    topbar_color: obj.topbar_color ?? DEFAULT_APPEARANCE.topbar_color,
    card_color: normalizeCardColor(obj.card_color),
    hero_overlay: obj.hero_overlay ?? DEFAULT_APPEARANCE.hero_overlay
  };
}

export async function fetchSiteAppearance(): Promise<SiteAppearance> {
  if (!supabase) return DEFAULT_APPEARANCE;
  const { data, error } = await supabase
    .from("site_settings")
    .select("data")
    .eq("id", "global")
    .maybeSingle();

  if (error || !data) return DEFAULT_APPEARANCE;
  return mergeAppearance((data as { data?: unknown }).data);
}

export async function saveSiteAppearance(
  patch: Partial<SiteAppearance>
): Promise<{ error: unknown }> {
  if (!supabase) return { error: new Error("Supabase ei ole konfiguroitu.") };
  // Merge with current row so partial updates keep other fields intact.
  const current = await fetchSiteAppearance();
  const merged = { ...current, ...patch };
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { id: "global", data: merged, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) {
    console.error("[site-appearance] save failed:", error);
  } else if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT));
  }
  return { error };
}

export async function uploadHeroImage(file: File): Promise<{ url: string | null; error: unknown }> {
  if (!supabase) return { url: null, error: new Error("Supabase ei ole konfiguroitu.") };
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `hero/hero-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("site-assets")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { url: null, error: uploadError };

  const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
