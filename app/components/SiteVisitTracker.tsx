"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { trackSiteVisit } from "@/lib/supabase";

export default function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function track() {
      if (cancelled) return;

      await trackSiteVisit({
        ip: null,
        path: pathname,
        userAgent: navigator.userAgent
      });
    }

    void track();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
