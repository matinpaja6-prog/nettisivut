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
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, parameters);
}
