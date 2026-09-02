"use client";

import { useSearchParams } from "next/navigation";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  COOKIE_CONSENT_EVENT,
  readCookieConsentSettings
} from "@/lib/cookie-consent";

import { useReportWebVitals } from "next/web-vitals";
import { trackAnalyticsEvent, measurementPage } from "@/lib/analytics";
import { measurementId, measurementDebugParameters, recordLocalMeasurementState, recordLocalWebVital } from "@/lib/measurement-config";

const analyticsId = measurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, "analytics");
const adsId = measurementId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID, "ads");
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
  const configuredTags = useRef(new Set<string>());
  const [consentVersion, setConsentVersion] = useState(0);
  useReportWebVitals(useCallback((metric) => {
    recordLocalWebVital(metric);
    const sample = {
      metric_id: metric.id, metric_name: metric.name, metric_value: metric.value,
      metric_delta: metric.delta, metric_rating: metric.rating,
      navigation_type: metric.navigationType,
      ...measurementPage(window.location.pathname)
    };
    trackAnalyticsEvent("web_vital", sample);
  }, []));
  useEffect(() => {
    const onConsent = () => setConsentVersion(value => value + 1);
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
  }, []);
  const previousPage = useRef("");

  useEffect(() => {
    const consent = readCookieConsentSettings();
    recordLocalMeasurementState({ gaConfigured: Boolean(analyticsId), analyticsConsent: consent.analytics, debug: Boolean(measurementDebugParameters().debug_mode) });
    if (!googleTagId) return;
    const allowedTags = [consent.analytics ? analyticsId : "", consent.personalization ? adsId : ""].filter(Boolean);
    if (!initialized.current && !allowedTags.length) return;
    const firstLoad = !initialized.current;
    if (firstLoad) {
      initialized.current = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() {
        // gtag.js identifies commands by their Arguments object type. A rest
        // array is interpreted as a data-layer method call and silently ignored.
        window.dataLayer?.push(arguments);
      };
      window.gtag("consent", "default", {
        analytics_storage: "denied", ad_storage: "denied",
        ad_user_data: "denied", ad_personalization: "denied", wait_for_update: 500
      });
      window.gtag("js", new Date());
    }
    updateGoogleConsent();
    if (analyticsId) (window as unknown as Record<string, unknown>)[`ga-disable-${analyticsId}`] = !consent.analytics;
    for (const id of allowedTags) {
      if (configuredTags.current.has(id)) continue;
      window.gtag?.("config", id, { send_page_view: false, ...measurementDebugParameters() });
      configuredTags.current.add(id);
    }
    if (firstLoad) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(allowedTags[0])}`;
      script.dataset.maskinesGoogleTag = "true";
      recordLocalMeasurementState({ tagStatus: "loading" });
      script.onload = () => recordLocalMeasurementState({ tagStatus: "loaded" });
      script.onerror = () => recordLocalMeasurementState({ tagStatus: "error" });
      document.head.appendChild(script);
    }

  }, [consentVersion]);

  useEffect(() => {
    if (!analyticsId || typeof window.gtag !== "function" || !readCookieConsentSettings().analytics) { previousPage.current = ""; return; }
    const { page_path: pagePath, language } = measurementPage(pathname || "/");
    if (previousPage.current === pagePath) return;
    previousPage.current = pagePath;
    window.gtag("event", "page_view", {
      page_location: window.location.origin + pagePath,
      page_path: pagePath,
      page_title: "Maskines " + pagePath,
      ...measurementDebugParameters(),
      send_to: analyticsId,
      language
    });
    recordLocalMeasurementState({ lastQueuedEvent: "page_view", lastQueuedPage: pagePath });
  }, [pathname, searchParams, consentVersion]);

  return null;
}
