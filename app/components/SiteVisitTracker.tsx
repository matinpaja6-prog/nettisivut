"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { supabase } from "@/lib/supabase";
import {
  COOKIE_CONSENT_EVENT,
  readCookieConsentSettings
} from "@/lib/cookie-consent";

export default function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    let tracked = false;

    async function track() {
      if (cancelled || tracked || !readCookieConsentSettings().analytics) return;
      tracked = true;

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

    const handleConsentChange = () => {
      if (readCookieConsentSettings().analytics) void track();
    };

    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);

    return () => {
      cancelled = true;
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    };
  }, [pathname]);

  return null;
}
