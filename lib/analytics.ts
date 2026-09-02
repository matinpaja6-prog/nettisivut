import { readCookieConsentSettings } from "./cookie-consent";
import { measurementId, measurementDebugParameters, recordLocalMeasurementState } from "./measurement-config";

const analyticsDestination = measurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, "analytics");

export type AnalyticsEventParameters = Record<
  string,
  string | number | boolean | null | undefined | Array<Record<string, unknown>>
>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackAnalyticsEvent(
  eventName: string,
  parameters: AnalyticsEventParameters = {}
) {
  if (!analyticsDestination || typeof window === "undefined" || typeof window.gtag !== "function" || !readCookieConsentSettings().analytics) return false;
  const page = measurementPage(window.location?.pathname || "/");
  window.gtag("event", eventName, {
    ...parameters, ...page,
    page_location: (window.location?.origin || "") + page.page_path,
    page_title: "Maskines " + page.page_path,
    ...measurementDebugParameters(),
    send_to: analyticsDestination
  });
  recordLocalMeasurementState({ lastQueuedEvent: eventName, lastQueuedPage: page.page_path });
  return true;
}
/** Remove private route identifiers/query strings before measurement. */
export function measurementPage(path: string) {
  const parts = path.split(/[?#]/,1)[0].split("/").filter(Boolean);
  const language = ["en","sv","no"].includes(parts[0]) ? parts.shift()! : "fi";
  const privateRoutes = ["admin","auth","kirjaudu","logga-in","logg-inn","profil","installningar","innstillinger","garage","talli","garasje","saved","tallennetut","sparade","lagret","my-listings","omat-ilmoitukset","mina-annonser","mine-annonser","messages","viestit","meddelanden","meldinger","profile","profiili","settings","asetukset","orders","tilaukset","tilaus","yritys","sell","myy","salj","selg"];
  const page = privateRoutes.includes(parts[0]) ? "/" + parts[0] : "/" + parts.join("/");
  return { language, page_path: (language === "fi" ? "" : "/" + language) + (page === "/" && language !== "fi" ? "" : page) };
}

const purchaseMemory = new Set<string>();
export function trackPurchaseOnce(input: { id: string; totalCents: number; shippingCents: number; taxCents: number; itemCount: number; language: string }) {
  if (typeof window === "undefined" || !readCookieConsentSettings().analytics || !input.id) return false;
  const storageKey = "maskines:measured-purchases";
  let saved: string[] = [];
  try { const value: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) || "[]"); if (Array.isArray(value)) saved = value.filter(item => typeof item === "string").slice(-100); } catch {}
  if (purchaseMemory.has(input.id) || saved.includes(input.id)) return false;
  const sent = trackAnalyticsEvent("purchase", {
    transaction_id: input.id, currency: "EUR",
    value: Math.max(0, input.totalCents - input.shippingCents - input.taxCents) / 100,
    shipping: input.shippingCents / 100, tax: input.taxCents / 100,
    order_total: input.totalCents / 100, item_count: input.itemCount, language: input.language
  });
  if (sent) {
    purchaseMemory.add(input.id);
    if (purchaseMemory.size > 100) purchaseMemory.delete(purchaseMemory.values().next().value!);
    try { window.sessionStorage.setItem(storageKey, JSON.stringify([...saved,input.id].slice(-100))); } catch {}
  }
  return sent;
}
