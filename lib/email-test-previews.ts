import "server-only";

import { escapeEmailHtml, type EmailLocale } from "@/lib/email-template";
import { absoluteSiteUrl } from "@/lib/site-url";

const copy = {
  fi: {
    order: ["Tilausvahvistus M-2026-1042", "TILAUSVAHVISTUS", "Kiitos tilauksestasi", "Maksu on vahvistettu ja tilauksesi on välitetty myyjälle käsiteltäväksi.", "Avaa tilaus"],
    seller: ["Uusi maksettu tilaus M-2026-1042", "UUSI MAKSETTU TILAUS", "Sait uuden tilauksen", "Asiakkaan maksu on vahvistettu. Valmistele tuotteet toimitusta tai noutoa varten.", "Avaa hallintapaneeli"],
    shipped: ["Tilauksesi M-2026-1042 on lähetetty", "TILAUS LÄHETETTY", "Tilauksesi on matkalla", "Myyjä on lähettänyt tilauksesi. Voit seurata lähetystä seurantatunnuksella.", "Seuraa lähetystä"],
    pickup: ["Tilauksesi M-2026-1042 on valmis noudettavaksi", "VALMIS NOUTOON", "Tilauksesi on valmis", "Myyjä on valmistellut tilauksesi noutoa varten. Ota tarvittaessa yhteyttä myyjään ennen saapumista.", "Avaa tilaus"],
    receipt: ["Kuitti yritysvahvistuksesta MV-20260826-TEST", "MAKSUN VAHVISTUS", "Kiitos maksustasi", "Yritysvahvistuksen maksu on vastaanotettu ja yritystietojen tarkistus voi alkaa.", "Avaa yritysprofiili"],
    summary: "Tilaus M-2026-1042 · Arctic Parts Oy · Maksettu yhteensä 1 248,00 €",
    tracking: "Seurantatunnus: JJFI00001234567890",
    notice: "Tämä on Maskinesin automaattinen palveluviesti."
  },
  en: {
    order: ["Order confirmation M-2026-1042", "ORDER CONFIRMATION", "Thank you for your order", "Your payment is confirmed and the order has been sent to the seller for processing.", "Open order"],
    seller: ["New paid order M-2026-1042", "NEW PAID ORDER", "You received a new order", "The customer payment is confirmed. Prepare the items for delivery or collection.", "Open dashboard"],
    shipped: ["Your order M-2026-1042 has shipped", "ORDER SHIPPED", "Your order is on its way", "The seller has shipped your order. You can follow the delivery using the tracking code.", "Track shipment"],
    pickup: ["Your order M-2026-1042 is ready for collection", "READY FOR COLLECTION", "Your order is ready", "The seller has prepared your order for collection. Contact the seller before arrival if needed.", "Open order"],
    receipt: ["Company verification receipt MV-20260826-TEST", "PAYMENT CONFIRMATION", "Thank you for your payment", "Your company verification payment was received and the review can now begin.", "Open company profile"],
    summary: "Order M-2026-1042 · Arctic Parts Ltd · Total paid €1,248.00",
    tracking: "Tracking code: JJFI00001234567890",
    notice: "This is an automated service message from Maskines."
  },
  sv: {
    order: ["Orderbekräftelse M-2026-1042", "ORDERBEKRÄFTELSE", "Tack för din beställning", "Betalningen är bekräftad och beställningen har skickats till säljaren för behandling.", "Öppna beställningen"],
    seller: ["Ny betald beställning M-2026-1042", "NY BETALD BESTÄLLNING", "Du har fått en ny beställning", "Kundens betalning är bekräftad. Förbered produkterna för leverans eller avhämtning.", "Öppna kontrollpanelen"],
    shipped: ["Din beställning M-2026-1042 har skickats", "BESTÄLLNING SKICKAD", "Din beställning är på väg", "Säljaren har skickat din beställning. Du kan följa leveransen med spårningskoden.", "Spåra leveransen"],
    pickup: ["Din beställning M-2026-1042 är klar för avhämtning", "KLAR FÖR AVHÄMTNING", "Din beställning är klar", "Säljaren har förberett beställningen för avhämtning. Kontakta säljaren före ankomst vid behov.", "Öppna beställningen"],
    receipt: ["Kvitto för företagsverifiering MV-20260826-TEST", "BETALNINGSBEKRÄFTELSE", "Tack för din betalning", "Betalningen för företagsverifieringen har mottagits och granskningen kan börja.", "Öppna företagsprofilen"],
    summary: "Beställning M-2026-1042 · Arctic Parts AB · Betalt totalt 1 248,00 €",
    tracking: "Spårningskod: JJFI00001234567890",
    notice: "Detta är ett automatiskt servicemeddelande från Maskines."
  },
  no: {
    order: ["Ordrebekreftelse M-2026-1042", "ORDREBEKREFTELSE", "Takk for bestillingen", "Betalingen er bekreftet, og bestillingen er sendt til selgeren for behandling.", "Åpne bestillingen"],
    seller: ["Ny betalt bestilling M-2026-1042", "NY BETALT BESTILLING", "Du har mottatt en ny bestilling", "Kundens betaling er bekreftet. Klargjør varene for levering eller henting.", "Åpne kontrollpanelet"],
    shipped: ["Bestillingen M-2026-1042 er sendt", "BESTILLING SENDT", "Bestillingen er på vei", "Selgeren har sendt bestillingen. Du kan følge leveringen med sporingskoden.", "Spor forsendelsen"],
    pickup: ["Bestillingen M-2026-1042 er klar for henting", "KLAR FOR HENTING", "Bestillingen er klar", "Selgeren har klargjort bestillingen for henting. Kontakt selgeren før ankomst ved behov.", "Åpne bestillingen"],
    receipt: ["Kvittering for bedriftsverifisering MV-20260826-TEST", "BETALINGSBEKREFTELSE", "Takk for betalingen", "Betalingen for bedriftsverifiseringen er mottatt, og kontrollen kan begynne.", "Åpne bedriftsprofilen"],
    summary: "Bestilling M-2026-1042 · Arctic Parts AS · Totalt betalt € 1 248,00",
    tracking: "Sporingskode: JJFI00001234567890",
    notice: "Dette er en automatisk servicemelding fra Maskines."
  }
} as const;

type PreviewKind = "order" | "seller" | "shipped" | "pickup" | "receipt";

export function commerceEmailTestPreviews(locale: EmailLocale) {
  const text = copy[locale];
  const kinds: PreviewKind[] = ["order", "seller", "shipped", "pickup", "receipt"];

  return kinds.map((kind) => {
    const [subject, eyebrow, title, lead, actionLabel] = text[kind];
    const detail = kind === "shipped" ? text.tracking : text.summary;
    const actionUrl = kind === "seller"
      ? absoluteSiteUrl("/yritys")
      : kind === "receipt"
        ? absoluteSiteUrl("/profile")
        : kind === "shipped"
          ? "https://www.posti.fi/fi/seuranta#/lahetys/JJFI00001234567890"
          : absoluteSiteUrl("/tilaukset");
    const partyDetails = kind === "seller"
      ? "Buyer: Test Buyer · buyer@example.com · +358 40 123 4567"
      : "Seller: Arctic Parts Oy · Business ID 1234567-8";
    const panel = `<div class="email-panel" style="padding:19px 20px;border:1px solid #dce5ed;border-radius:14px;background:#f7f9fb;color:#52677a;font-size:14px;line-height:22px;text-align:left;"><strong class="email-strong" style="display:block;margin-bottom:5px;color:#10243e;">${escapeEmailHtml(detail)}</strong><span style="display:block;margin-bottom:12px;">${escapeEmailHtml(partyDetails)}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="padding:8px 0;border-top:1px solid #dce5ed">Arctic Cat variator</td><td align="center" style="padding:8px;border-top:1px solid #dce5ed">1 ×</td><td align="right" style="padding:8px 0;border-top:1px solid #dce5ed;font-weight:700">999,00 €</td></tr><tr><td style="padding:8px 0;border-top:1px solid #dce5ed">Drive belt</td><td align="center" style="padding:8px;border-top:1px solid #dce5ed">2 ×</td><td align="right" style="padding:8px 0;border-top:1px solid #dce5ed;font-weight:700">249,00 €</td></tr></table></div>`;

    return {
      label: `commerce-${kind}-${locale}`,
      email: {
        subject,
        text: `${title}\n\n${lead}\n\n${detail}\n\n${actionLabel}: ${actionUrl}`,
        branding: "neutral" as const,
        html: `<!doctype html><html lang="${locale === "no" ? "nb" : locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmailHtml(subject)}</title></head><body class="email-bg" style="margin:0;padding:0;background:#edf1f4;color:#1d2a33"><table class="email-bg" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf1f4;border-collapse:collapse"><tr><td align="center" style="padding:28px 12px;font-family:Arial,Helvetica,sans-serif"><table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #d5dadd;border-radius:16px;background:#ffffff;overflow:hidden"><tr><td class="email-header" style="padding:24px 28px;border-bottom:1px solid #d5dadd;background:#f6f8fa"><div style="color:#50697b;font-size:11px;font-weight:800;letter-spacing:1.4px">${escapeEmailHtml(eyebrow)}</div><h1 class="email-title" style="margin:10px 0 6px;color:#1d2a33;font-size:26px;line-height:1.25">${escapeEmailHtml(title)}</h1><p class="email-copy" style="margin:0;color:#5f6b73;font-size:14px;line-height:1.55">${escapeEmailHtml(lead)}</p></td></tr><tr><td class="email-content" style="padding:25px 28px">${panel}<p style="margin:22px 0 0;text-align:center"><a href="${escapeEmailHtml(actionUrl)}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#315f7e;color:#ffffff;text-decoration:none;font-weight:800">${escapeEmailHtml(actionLabel)}</a></p></td></tr><tr><td class="email-footer" style="padding:16px 24px;border-top:1px solid #d5dadd;background:#f6f8fa;color:#6b7780;font-size:11px;text-align:center">${escapeEmailHtml(text.notice)}</td></tr></table></td></tr></table></body></html>`
      }
    };
  });
}
