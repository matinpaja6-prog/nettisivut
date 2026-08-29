import { NextResponse } from "next/server";

import { FALLBACK_CURRENCY_RATES } from "@/lib/currency";

export const revalidate = 3600;

function readRate(xml: string, currency: "SEK" | "NOK") {
  const match = xml.match(new RegExp(`currency=['\"]${currency}['\"]\\s+rate=['\"]([0-9.]+)['\"]`, "i"));
  const rate = Number(match?.[1]);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export async function GET() {
  try {
    const response = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", {
      next: { revalidate: 3600 },
      headers: { Accept: "application/xml,text/xml" }
    });
    if (!response.ok) throw new Error(`ECB ${response.status}`);
    const xml = await response.text();
    const sek = readRate(xml, "SEK");
    const nok = readRate(xml, "NOK");
    if (!sek || !nok) throw new Error("ECB-kurssit puuttuvat.");

    return NextResponse.json({ base: "EUR", rates: { EUR: 1, SEK: sek, NOK: nok }, source: "ECB" });
  } catch {
    return NextResponse.json({ base: "EUR", rates: FALLBACK_CURRENCY_RATES, source: "fallback" });
  }
}
