"use client";

import { useEffect } from "react";
import { usePathname } from "@/lib/navigation";

import { supabase } from "@/lib/supabase";
import { isLocalMeasurementHost } from "@/lib/measurement-config";
import {
  COOKIE_CONSENT_EVENT,
  readCookieConsentSettings
} from "@/lib/cookie-consent";

export default function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Local acceptance runs must not inflate the production visit counter.
    // GA4 has a separate, explicitly marked DebugView test path.
    if (isLocalMeasurementHost()) return;
    let cancelled = false;
    let tracked = false;

    async function track() {
      if (cancelled || tracked || !readCookieConsentSettings().analytics) return;
      tracked = true;

      const token = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : null;

      // Consent can be withdrawn (or the route can unmount) while auth loads.
      if (cancelled || !readCookieConsentSettings().analytics) {
        tracked = false;
        return;
      }

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
