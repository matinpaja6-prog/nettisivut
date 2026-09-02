/** Ignore example values rather than loading Google with a placeholder ID. */
export function measurementId(value: string | undefined, kind: "analytics" | "ads") {
  const id = value?.trim() || "";
  const valid = kind === "analytics" ? /^G-[A-Z0-9]{4,20}$/.test(id) : /^AW-\d{5,20}$/.test(id);
  return valid && !/^G-X+$/.test(id) && !/YOUR|EXAMPLE|PLACEHOLDER/.test(id) ? id : "";
}

export function googleVerification(value: string | undefined) {
  const token = value?.trim().replace(/^google-site-verification=/, "") || "";
  return /^[A-Za-z0-9_-]{20,256}$/.test(token) && !/your-search-console|placeholder|example/i.test(token) ? token : "";
}

/** Local diagnostics only: no network, cookies, storage or user identifiers. */
export function isLocalMeasurementHost() {
  return typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(window.location?.hostname || "");
}

export function measurementDebugParameters() {
  return isLocalMeasurementHost() ? { debug_mode: true } : {};
}

/** Ephemeral diagnostic state, only in a local page's DOM, never in storage. */
export function recordLocalMeasurementState(update: Record<string, string | boolean | number>) {
  if (!isLocalMeasurementHost() || typeof document === "undefined") return;
  let previous: Record<string, unknown> = {};
  try { previous = JSON.parse(document.documentElement.dataset.maskinesMeasurement || "{}"); } catch {}
  document.documentElement.dataset.maskinesMeasurement = JSON.stringify({ ...previous, ...update });
}

export function recordLocalWebVital(metric: { name: string; value: number; rating?: string }) {
  if (!isLocalMeasurementHost() || typeof document === "undefined") return;
  const root = document.documentElement;
  let values: Record<string, unknown> = {};
  try {
    const stored = JSON.parse(root.dataset.maskinesLocalVitals || "{}");
    if (stored && typeof stored === "object" && !Array.isArray(stored)) values = stored;
  } catch {}
  values[metric.name] = { value: metric.value, rating: metric.rating };
  root.dataset.maskinesLocalVitals = JSON.stringify(values);
}
