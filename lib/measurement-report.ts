type RawEvent = {
  event_name: string; event_timestamp?: number; user_pseudo_id?: string;
  event_params?: Array<{ key: string; value: { string_value?: string; int_value?: number | string; double_value?: number; float_value?: number } }>;
  device?: { category?: string };
  parameters?: Record<string, string | number>; // normalized local fixture/export format
};
const thresholds: Record<string, number> = { LCP: 2500, INP: 200, CLS: 0.1 };
export function summarizeMeasurement(events: RawEvent[], minimumSamples = 100) {
  const latest = new Map<string, { metric: string; device: string; language: string; value: number; time: number }>();
  const visited = new Set<string>(), purchased = new Set<string>(), transactions = new Set<string>();
  for (const event of events) {
    const params: Record<string, string | number> = event.parameters || Object.fromEntries((event.event_params || []).map(item => [
      item.key, item.value.string_value ?? item.value.int_value ?? item.value.double_value ?? item.value.float_value ?? ""
    ]));
    const session = event.user_pseudo_id && params.ga_session_id ? event.user_pseudo_id + ":" + params.ga_session_id : null;
    if (session && event.event_name === "page_view") visited.add(session);
    if (event.event_name === "purchase" && params.transaction_id) {
      transactions.add(String(params.transaction_id));
      if (session) purchased.add(session);
    }
    if (event.event_name !== "web_vital" || !params.metric_id || !(String(params.metric_name) in thresholds)) continue;
    const value = Number(params.metric_value);
    if (!Number.isFinite(value) || value < 0) continue;
    const key = String(params.metric_id) + ":" + params.metric_name;
    const time = Number(event.event_timestamp || 0);
    if (!latest.has(key) || latest.get(key)!.time <= time) latest.set(key, {
      metric: String(params.metric_name), value, time, device: event.device?.category || "unknown", language: String(params.language || "unknown")
    });
  }
  const groups = new Map<string, typeof latest extends Map<string, infer V> ? V[] : never>();
  for (const metric of latest.values()) {
    const key = [metric.metric,metric.device,metric.language].join(":");
    const group = groups.get(key) || []; group.push(metric); groups.set(key,group);
  }
  const vitals = [...groups.values()].map(rows => {
    const values = rows.map(row => row.value).sort((a,b)=>a-b);
    const p75 = values[Math.max(0,Math.ceil(values.length * .75)-1)];
    return { metric:rows[0].metric, device:rows[0].device, language:rows[0].language, samples:values.length,
      p75, unit:rows[0].metric === "CLS" ? "score" : "ms",
      status:values.length < minimumSamples ? "insufficient_sample" : p75 <= thresholds[rows[0].metric] ? "good" : "needs_improvement" };
  });
  const converted = [...purchased].filter(session=>visited.has(session)).length;
  return {
    minimumSamples, policy:"Local reporting guard, not a Google eligibility rule. Consent-based observations only; not all users. No production speedup inferred.",
    vitals, conversions:{sessions:visited.size, paidSessions:converted, uniqueTransactions:transactions.size,
      paidSessionRate:visited.size ? converted / visited.size : null,
      status:visited.size < minimumSamples ? "insufficient_sample" : "observed"}
  };
}
