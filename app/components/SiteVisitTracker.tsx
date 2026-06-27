"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function track() {
      if (cancelled) return;

      const token = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : null;

      await fetch("/api/site-visit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        keepalive: true,
        body: JSON.stringify({
          path: pathname,
          userAgent: navigator.userAgent
        })
      }).catch(() => undefined);
    }

    void track();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
