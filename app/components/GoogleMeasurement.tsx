"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  COOKIE_CONSENT_EVENT,
  readCookieConsentSettings
} from "@/lib/cookie-consent";

const analyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ?? "";
const googleTagId = analyticsId || adsId;

function updateGoogleConsent() {
  if (typeof window.gtag !== "function") return;
  const consent = readCookieConsentSettings();
  window.gtag("consent", "update", {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.personalization ? "granted" : "denied",
    ad_user_data: consent.personalization ? "granted" : "denied",
    ad_personalization: consent.personalization ? "granted" : "denied"
  });
}

export default function GoogleMeasurement() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);
  const previousPage = useRef("");

  useEffect(() => {
    if (!googleTagId || initialized.current) return;
    initialized.current = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500
    });
    updateGoogleConsent();
    window.gtag("js", new Date());
    if (analyticsId) window.gtag("config", analyticsId, { send_page_view: false });
    if (adsId) window.gtag("config", adsId, { send_page_view: false });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`;
    script.dataset.maskinesGoogleTag = "true";
    document.head.appendChild(script);

    window.addEventListener(COOKIE_CONSENT_EVENT, updateGoogleConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, updateGoogleConsent);
  }, []);

  useEffect(() => {
    if (!analyticsId || typeof window.gtag !== "function") return;
    const query = searchParams.toString();
    const pagePath = `${pathname}${query ? `?${query}` : ""}`;
    if (previousPage.current === pagePath) return;
    previousPage.current = pagePath;
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: pagePath,
      page_title: document.title
    });
  }, [pathname, searchParams]);

  return null;
}
