"use client";

import { useEffect } from "react";
import {
  APPEARANCE_EVENT,
  DEFAULT_APPEARANCE,
  fetchSiteAppearance,
  type SiteAppearance
} from "@/lib/site-appearance";
import { supabase } from "@/lib/supabase";

const APPEARANCE_CACHE_KEY = "arctic-appearance-cache-v1";

function applyAppearance(a: SiteAppearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const hero = a.hero_image_url || DEFAULT_APPEARANCE.hero_image_url;
  root.style.setProperty("--hero-bg-url", `url("${hero}")`);
  // Cache so next visit applies instantly (avoids ~2s flash to default).
  try {
    localStorage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify(a));
  } catch {}
  if (a.primary_color) {
    root.style.setProperty("--orange", a.primary_color);
    root.style.setProperty("--blue", a.primary_color);
    root.style.setProperty("--brand-primary", a.primary_color);
  }
  if (a.accent_color) {
    root.style.setProperty("--orange-2", a.accent_color);
    root.style.setProperty("--blue-2", a.accent_color);
    root.style.setProperty("--brand-accent", a.accent_color);
  }
  if (a.background_color) {
    root.style.setProperty("--bg", a.background_color);
    root.style.setProperty("--site-bg", a.background_color);
    root.style.setProperty("--app-page-bg", "none");
  }
  if (a.surface_color) {
    root.style.setProperty("--bg-2", a.surface_color);
    root.style.setProperty("--surface", a.surface_color);
    root.style.setProperty("--surface-2", a.surface_color);
    root.style.setProperty("--brand-dark-surface", a.surface_color);
  }
  if (a.card_color) {
    root.style.setProperty("--site-card", a.card_color);
    root.style.setProperty("--listing-card-bg", a.card_color);
  }
  if (a.text_color) {
    root.style.setProperty("--text", a.text_color);
    root.style.setProperty("--brand-text-on-dark", a.text_color);
  }
  if (a.muted_color) {
    root.style.setProperty("--muted", a.muted_color);
    root.style.setProperty("--brand-muted-on-dark", a.muted_color);
  }
  if (a.line_color) {
    root.style.setProperty("--line", a.line_color);
  }
  if (a.topbar_color) {
    root.style.setProperty("--site-topbar", a.topbar_color);
  }
  if (a.hero_overlay) {
    root.style.setProperty("--hero-overlay", a.hero_overlay);
  }
}

export default function SiteAppearance() {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const a = await fetchSiteAppearance();
      if (!cancelled) applyAppearance(a);
    }
    void load();

    function onChange() {
      void load();
    }
    window.addEventListener(APPEARANCE_EVENT, onChange);

    // Live updates from other admin tabs via Supabase realtime.
    const channel = supabase
      ?.channel("site-settings-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "site_settings" },
        () => void load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener(APPEARANCE_EVENT, onChange);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
