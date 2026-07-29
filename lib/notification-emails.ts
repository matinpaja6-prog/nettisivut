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
}) {
  const lang = input.locale === "no" ? "nb" : input.locale;

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#07111d;color:#f7fafc;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#07111d;">
      <tr>
        <td align="center" style="padding:34px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;max-width:620px;overflow:hidden;border:1px solid #24384b;border-radius:18px;background:#0d1b29;box-shadow:0 24px 60px rgba(0,0,0,.35);">
            <tr>
              <td style="height:6px;background:#ff7a1a;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:25px 30px;border-bottom:1px solid #213548;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font:900 23px/1 Arial,Helvetica,sans-serif;letter-spacing:.4px;color:#ffffff;">MASKINES</td>
                    <td align="right" style="font:800 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.6px;color:#ff9a4d;">${escapeHtml(input.eyebrow)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 30px 30px;">
                <h1 style="margin:0 0 13px;font:900 30px/1.12 Arial,Helvetica,sans-serif;color:#ffffff;">${escapeHtml(input.title)}</h1>
                <p style="margin:0 0 27px;font:500 16px/1.65 Arial,Helvetica,sans-serif;color:#b9c8d8;">${escapeHtml(input.lead)}</p>
                ${input.card}
                <div style="margin-top:27px;">
                  <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#ff7a1a;color:#ffffff;font:800 15px/1 Arial,Helvetica,sans-serif;text-decoration:none;">${escapeHtml(input.actionLabel)} &nbsp;→</a>
                </div>
                ${input.note ? `<p style="margin:23px 0 0;font:500 13px/1.55 Arial,Helvetica,sans-serif;color:#8598aa;">${escapeHtml(input.note)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:21px 30px;border-top:1px solid #213548;background:#0a1723;">
                <p style="margin:0;font:500 12px/1.55 Arial,Helvetica,sans-serif;color:#8295a7;">
                  ${escapeHtml(input.settingsText)}
                  <a href="${escapeHtml(input.settingsUrl)}" style="color:#ff9a4d;text-decoration:none;font-weight:700;">${escapeHtml(input.settingsLabel)}</a>
                </p>
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
    preheader: `${text.searchSubject}: ${input.listingTitle}`,
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
    subject: `${text.searchSubject}: ${input.listingTitle}`,
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
    preheader: `${text.messageSubject}: ${input.senderName}`,
    eyebrow: String(text.messageEyebrow),
    title: String(text.messageTitle),
    lead,
    card,
    actionLabel: String(text.openMessage),
    actionUrl: input.conversationUrl,
    settingsText: String(text.settings),
    settingsLabel: String(text.settingsLink),
    settingsUrl: input.settingsUrl,
    note: String(text.privacy)
  });

  return {
    subject: `${text.messageSubject}: ${input.senderName}`,
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
