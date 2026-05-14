"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { trackSiteVisit } from "@/lib/supabase";

/**
 * Tallentaa sivuvierailun Supabase site_visits -tauluun joka kerta kun
 * polku muuttuu. IP haetaan kevyestä julkisesta API:sta (ipify) – jos
 * pyynt\u00f6 ep\u00e4onnistuu, tallennetaan ilman IP:t\u00e4.
 */
export default function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function track() {
      let ip: string | null = null;
      try {
        const response = await fetch("https://api.ipify.org?format=json", {
          cache: "no-store"
        });
        if (response.ok) {
          const json = (await response.json()) as { ip?: string };
          ip = json.ip ?? null;
        }
      } catch {
        // ignore
      }

      if (cancelled) return;

      await trackSiteVisit({
        ip,
        path: pathname,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null
      });
    }

    void track();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
