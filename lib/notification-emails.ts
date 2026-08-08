import "server-only";

export type NotificationEmailLocale = "fi" | "en" | "sv" | "no";

type EmailResult = {
  subject: string;
  html: string;
  text: string;
};

const localeTags: Record<NotificationEmailLocale, string> = {
  fi: "fi-FI",
  en: "en-US",
  sv: "sv-SE",
  no: "nb-NO"
};

const copy = {
  fi: {
    searchSubject: "Hakuvahti löysi uuden ilmoituksen",
    searchEyebrow: "HAKUVAHTI",
    searchTitle: "Sopiva ilmoitus löytyi",
    searchLead: "Tallentamasi hakuvahti löysi uuden ilmoituksen, joka vastaa hakuehtojasi.",
    alertLabel: "Hakuvahti",
    viewListing: "Katso ilmoitus",
    messageSubject: "Sinulle on uusi viesti Maskinesissa",
    messageEyebrow: "UUSI VIESTI",
    messageTitle: "Sait uuden viestin",
    messageLead: (sender: string) => `${sender} lähetti sinulle viestin.`,
    listingLabel: "Ilmoitus",
    openMessage: "Avaa viesti",
    privacy: "Viestin sisältöä ei näytetä sähköpostissa yksityisyytesi suojaamiseksi.",
    settings: "Voit hallita sähköposti-ilmoituksia Maskinesin asetuksissa.",
    settingsLink: "Avaa asetukset"
  },
  en: {
    searchSubject: "Your search alert found a new listing",
    searchEyebrow: "SEARCH ALERT",
    searchTitle: "A matching listing was found",
    searchLead: "Your saved search found a new listing that matches your criteria.",
    alertLabel: "Search alert",
    viewListing: "View listing",
    messageSubject: "You have a new message on Maskines",
    messageEyebrow: "NEW MESSAGE",
    messageTitle: "You received a new message",
    messageLead: (sender: string) => `${sender} sent you a message.`,
    listingLabel: "Listing",
    openMessage: "Open message",
    privacy: "The message content is not shown in this email to protect your privacy.",
    settings: "You can manage email notifications in your Maskines settings.",
    settingsLink: "Open settings"
  },
  sv: {
    searchSubject: "Din sökbevakning hittade en ny annons",
    searchEyebrow: "SÖKBEVAKNING",
    searchTitle: "En matchande annons hittades",
    searchLead: "Din sparade sökbevakning hittade en ny annons som matchar dina kriterier.",
    alertLabel: "Sökbevakning",
    viewListing: "Visa annonsen",
    messageSubject: "Du har ett nytt meddelande på Maskines",
    messageEyebrow: "NYTT MEDDELANDE",
    messageTitle: "Du fick ett nytt meddelande",
    messageLead: (sender: string) => `${sender} skickade ett meddelande till dig.`,
    listingLabel: "Annons",
    openMessage: "Öppna meddelandet",
    privacy: "Meddelandets innehåll visas inte i e-postmeddelandet för att skydda din integritet.",
    settings: "Du kan hantera e-postaviseringar i Maskines inställningar.",
    settingsLink: "Öppna inställningar"
  },
  no: {
    searchSubject: "Søkevarselet ditt fant en ny annonse",
    searchEyebrow: "SØKEVARSEL",
    searchTitle: "En passende annonse ble funnet",
    searchLead: "Det lagrede søkevarselet ditt fant en ny annonse som samsvarer med kriteriene dine.",
    alertLabel: "Søkevarsel",
    viewListing: "Se annonsen",
    messageSubject: "Du har en ny melding på Maskines",
    messageEyebrow: "NY MELDING",
    messageTitle: "Du mottok en ny melding",
    messageLead: (sender: string) => `${sender} sendte deg en melding.`,
    listingLabel: "Annonse",
    openMessage: "Åpne meldingen",
    privacy: "Meldingsinnholdet vises ikke i e-posten for å beskytte personvernet ditt.",
    settings: "Du kan administrere e-postvarsler i Maskines-innstillingene.",
    settingsLink: "Åpne innstillinger"
  }
} satisfies Record<NotificationEmailLocale, Record<string, string | ((value: string) => string)>>;

export function notificationEmailLocale(value: unknown): NotificationEmailLocale {
  return value === "en" || value === "sv" || value === "no" ? value : "fi";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailFrame(input: {
  locale: NotificationEmailLocale;
  preheader: string;
  eyebrow: string;
  title: string;
  lead: string;
  card: string;
  actionLabel: string;
  actionUrl: string;
  settingsText: string;
  settingsLabel: string;
  settingsUrl: string;
  note?: string;
  brandedHeader?: boolean;
}) {
  const lang = input.locale === "no" ? "nb" : input.locale;

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
    <style>
      @media only screen and (max-width: 680px) {
        .email-shell { padding: 12px 8px !important; }
        .email-card { border-radius: 14px !important; }
        .email-header { padding: 21px 22px !important; }
        .email-content { padding: 27px 22px 25px !important; }
        .email-footer { padding: 19px 22px !important; }
        .email-title { font-size: 27px !important; }
        .email-footer-copy,
        .email-footer-action { display: block !important; width: 100% !important; text-align: left !important; }
        .email-footer-action { padding-top: 14px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f3f6f8;color:#f7fafc;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f3f6f8;">
      <tr>
        <td class="email-shell" align="center" style="padding:28px 16px 34px;">
          <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;max-width:640px;overflow:hidden;border:1px solid #24384b;border-radius:18px;background:#0d1b29;box-shadow:0 12px 32px rgba(7,17,29,.16);">
            ${input.brandedHeader ? `<tr>
              <td class="email-header" align="center" style="padding:27px 24px 24px;border-bottom:5px solid #ff7a1a;background:#071c31;">
                <img src="https://maskines.com/maskines-email-logo.png" width="82" height="82" alt="Maskines" style="display:block;width:82px;height:82px;margin:0 auto 10px;border:0;border-radius:50%;">
                <div style="font:900 italic 27px/32px Arial,Helvetica,sans-serif;letter-spacing:.7px;color:#ffffff;">MASKINES</div>
                <div style="margin-top:3px;font:800 10px/14px Arial,Helvetica,sans-serif;letter-spacing:4px;color:#ff7a1a;">MARKETPLACE</div>
              </td>
            </tr>` : `<tr>
              <td style="height:6px;background:#ff7a1a;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td class="email-header" style="padding:23px 30px;border-bottom:1px solid #213548;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font:900 23px/1 Arial,Helvetica,sans-serif;letter-spacing:.4px;color:#ffffff;">MASKINES</td>
                    <td align="right" style="font:800 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.6px;color:#ff9a4d;">${escapeHtml(input.eyebrow)}</td>
                  </tr>
                </table>
              </td>
            </tr>`}
            <tr>
              <td class="email-content" style="padding:30px 30px 28px;">
                ${input.brandedHeader ? `<p style="margin:0 0 12px;font:800 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.6px;color:#ff9a4d;">${escapeHtml(input.eyebrow)}</p>` : ""}
                <h1 class="email-title" style="margin:0 0 11px;font:900 30px/1.15 Arial,Helvetica,sans-serif;color:#ffffff;">${escapeHtml(input.title)}</h1>
                <p style="margin:0 0 23px;font:500 16px/1.55 Arial,Helvetica,sans-serif;color:#c2ceda;">${escapeHtml(input.lead)}</p>
                ${input.card}
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:23px;">
                  <tr>
                    <td style="border-radius:10px;background:#ff7a1a;">
                      <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:15px 24px;color:#ffffff;font:800 15px/1 Arial,Helvetica,sans-serif;text-decoration:none;">${escapeHtml(input.actionLabel)} &nbsp;→</a>
                    </td>
                  </tr>
                </table>
                ${input.note ? `<p style="margin:20px 0 0;font:500 13px/1.55 Arial,Helvetica,sans-serif;color:#91a3b4;">${escapeHtml(input.note)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:18px 30px;border-top:1px solid #213548;background:#0a1723;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td class="email-footer-copy" style="padding-right:18px;font:500 12px/1.55 Arial,Helvetica,sans-serif;color:#8295a7;">
                      ${escapeHtml(input.settingsText)}
                    </td>
                    <td class="email-footer-action" align="right" style="white-space:nowrap;">
                      <a href="${escapeHtml(input.settingsUrl)}" style="display:inline-block;padding:10px 15px;border:1px solid #ff7a1a;border-radius:8px;color:#ff9a4d;font:800 12px/1 Arial,Helvetica,sans-serif;text-decoration:none;">${escapeHtml(input.settingsLabel)} &nbsp;→</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function searchAlertEmail(input: {
  locale: NotificationEmailLocale;
  alertLabel: string;
  listingTitle: string;
  price: number;
  listingUrl: string;
  settingsUrl: string;
}): EmailResult {
  const text = copy[input.locale];
  const price = new Intl.NumberFormat(localeTags[input.locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(input.price);
  const card = `
    <div style="padding:21px;border:1px solid #294158;border-radius:13px;background:#102335;">
      <p style="margin:0 0 7px;font:800 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.2px;color:#ff9a4d;">${escapeHtml(String(text.alertLabel).toUpperCase())}: ${escapeHtml(input.alertLabel)}</p>
      <p style="margin:0 0 10px;font:800 18px/1.35 Arial,Helvetica,sans-serif;color:#ffffff;">${escapeHtml(input.listingTitle)}</p>
      <p style="margin:0;font:900 25px/1 Arial,Helvetica,sans-serif;color:#ff8a2a;">${escapeHtml(price)}</p>
    </div>`;
  const html = emailFrame({
    locale: input.locale,
    preheader: `${text.searchLead} ${input.listingTitle}`,
    eyebrow: String(text.searchEyebrow),
    title: String(text.searchTitle),
    lead: String(text.searchLead),
    card,
    actionLabel: String(text.viewListing),
    actionUrl: input.listingUrl,
    settingsText: String(text.settings),
    settingsLabel: String(text.settingsLink),
    settingsUrl: input.settingsUrl
  });

  return {
    subject: String(text.searchSubject),
    html,
    text: [
      String(text.searchTitle),
      String(text.searchLead),
      "",
      `${text.alertLabel}: ${input.alertLabel}`,
      input.listingTitle,
      price,
      "",
      `${text.viewListing}: ${input.listingUrl}`,
      `${text.settingsLink}: ${input.settingsUrl}`
    ].join("\n")
  };
}

export function newMessageEmail(input: {
  locale: NotificationEmailLocale;
  senderName: string;
  listingTitle: string;
  conversationUrl: string;
  settingsUrl: string;
}): EmailResult {
  const text = copy[input.locale];
  const lead = (text.messageLead as (sender: string) => string)(input.senderName);
  const card = `
    <div style="padding:21px;border:1px solid #294158;border-radius:13px;background:#102335;">
      <p style="margin:0 0 7px;font:800 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.2px;color:#ff9a4d;">${escapeHtml(String(text.listingLabel).toUpperCase())}</p>
      <p style="margin:0;font:800 18px/1.35 Arial,Helvetica,sans-serif;color:#ffffff;">${escapeHtml(input.listingTitle)}</p>
    </div>`;
  const html = emailFrame({
    locale: input.locale,
    preheader: String(text.privacy),
    eyebrow: String(text.messageEyebrow),
    title: String(text.messageTitle),
    lead,
    card,
    actionLabel: String(text.openMessage),
    actionUrl: input.conversationUrl,
    settingsText: String(text.settings),
    settingsLabel: String(text.settingsLink),
    settingsUrl: input.settingsUrl,
    note: String(text.privacy),
    brandedHeader: true
  });

  return {
    subject: String(text.messageSubject),
    html,
    text: [
      String(text.messageTitle),
      lead,
      `${text.listingLabel}: ${input.listingTitle}`,
      String(text.privacy),
      "",
      `${text.openMessage}: ${input.conversationUrl}`,
      `${text.settingsLink}: ${input.settingsUrl}`
    ].join("\n")
  };
}
