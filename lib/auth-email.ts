import "server-only";

export type AuthEmailLocale = "fi" | "en" | "sv" | "no";
export type AuthEmailKind =
  | "registration"
  | "login"
  | "password-reset"
  | "password-change";

type AuthEmailInput = {
  kind: AuthEmailKind;
  locale: AuthEmailLocale;
  code?: string;
  actionUrl?: string;
};

const copy = {
  fi: {
    registration: ["Maskines – rekisteröintikoodi", "Vahvista sähköpostisi", "Syötä tämä vahvistuskoodi Maskines-palvelussa viimeistelläksesi rekisteröitymisen."],
    login: ["Maskines – kirjautumiskoodi", "Vahvista kirjautuminen", "Syötä tämä vahvistuskoodi Maskines-palvelussa jatkaaksesi kirjautumista."],
    "password-reset": ["Maskines – vaihda salasana", "Luo uusi salasana", "Saimme pyynnön vaihtaa Maskines-tilisi salasanan.", "Vaihda salasana"],
    "password-change": ["Maskines – salasanan vaihtokoodi", "Vaihda salasanasi", "Syötä tämä vahvistuskoodi Maskines-palvelussa jatkaaksesi salasanan vaihtoa."],
    expiry: "Koodi tai linkki vanhenee pian. Jos et pyytänyt tätä, voit jättää viestin huomiotta.",
    footer: "Tämä on automaattinen turvallisuusviesti Maskines-palvelusta."
  },
  en: {
    registration: ["Maskines – registration code", "Verify your email", "Enter this verification code in Maskines to finish your registration."],
    login: ["Maskines – sign-in code", "Verify your sign-in", "Enter this verification code in Maskines to continue signing in."],
    "password-reset": ["Maskines – reset your password", "Create a new password", "We received a request to change the password for your Maskines account.", "Change password"],
    "password-change": ["Maskines – password change code", "Change your password", "Enter this verification code in Maskines to continue changing your password."],
    expiry: "The code or link expires soon. If you did not request this, you can ignore this message.",
    footer: "This is an automated security message from Maskines."
  },
  sv: {
    registration: ["Maskines – registreringskod", "Bekräfta din e-post", "Ange den här verifieringskoden i Maskines för att slutföra registreringen."],
    login: ["Maskines – inloggningskod", "Bekräfta inloggningen", "Ange den här verifieringskoden i Maskines för att fortsätta logga in."],
    "password-reset": ["Maskines – byt lösenord", "Skapa ett nytt lösenord", "Vi fick en begäran om att byta lösenordet till ditt Maskines-konto.", "Byt lösenord"],
    "password-change": ["Maskines – kod för lösenordsbyte", "Byt ditt lösenord", "Ange den här verifieringskoden i Maskines för att fortsätta byta lösenord."],
    expiry: "Koden eller länken upphör snart att gälla. Om du inte begärde detta kan du ignorera meddelandet.",
    footer: "Detta är ett automatiskt säkerhetsmeddelande från Maskines."
  },
  no: {
    registration: ["Maskines – registreringskode", "Bekreft e-posten din", "Skriv inn denne bekreftelseskoden i Maskines for å fullføre registreringen."],
    login: ["Maskines – innloggingskode", "Bekreft innloggingen", "Skriv inn denne bekreftelseskoden i Maskines for å fortsette innloggingen."],
    "password-reset": ["Maskines – tilbakestill passordet", "Opprett et nytt passord", "Vi mottok en forespørsel om å endre passordet til Maskines-kontoen din.", "Bytt passord"],
    "password-change": ["Maskines – kode for passordbytte", "Bytt passordet ditt", "Skriv inn denne bekreftelseskoden i Maskines for å fortsette passordbyttet."],
    expiry: "Koden eller lenken utløper snart. Hvis du ikke ba om dette, kan du se bort fra meldingen.",
    footer: "Dette er en automatisk sikkerhetsmelding fra Maskines."
  }
} as const;

const securityNotice: Record<AuthEmailLocale, Record<AuthEmailKind, string>> = {
  fi: {
    registration: "Etkö ollut rekisteröitymässä? Voit jättää tämän viestin huomiotta — tiliä ei vahvisteta ilman koodia.",
    login: "Etkö yrittänyt kirjautua? Älä jaa koodia kenellekään. Maskines ei koskaan kysy vahvistuskoodiasi.",
    "password-reset": "Etkö pyytänyt tätä? Salasanaasi ei ole muutettu. Voit turvallisesti jättää viestin huomiotta.",
    "password-change": "Etkö pyytänyt salasanan vaihtoa? Älä jaa koodia kenellekään ja jätä viesti huomiotta."
  },
  en: {
    registration: "Didn’t start this registration? You can ignore this message — the account cannot be verified without the code.",
    login: "Didn’t try to sign in? Never share this code. Maskines will never ask you for your verification code.",
    "password-reset": "Didn’t request this? Your password has not been changed. You can safely ignore this message.",
    "password-change": "Didn’t request a password change? Never share this code and ignore this message."
  },
  sv: {
    registration: "Påbörjade du inte registreringen? Du kan ignorera meddelandet — kontot kan inte bekräftas utan koden.",
    login: "Försökte du inte logga in? Dela aldrig koden. Maskines kommer aldrig att be dig om verifieringskoden.",
    "password-reset": "Begärde du inte detta? Ditt lösenord har inte ändrats. Du kan tryggt ignorera meddelandet.",
    "password-change": "Begärde du inte ett lösenordsbyte? Dela aldrig koden och ignorera meddelandet."
  },
  no: {
    registration: "Startet du ikke registreringen? Du kan se bort fra meldingen — kontoen kan ikke bekreftes uten koden.",
    login: "Forsøkte du ikke å logge inn? Del aldri koden. Maskines vil aldri be deg om bekreftelseskoden.",
    "password-reset": "Ba du ikke om dette? Passordet ditt er ikke endret. Du kan trygt se bort fra meldingen.",
    "password-change": "Ba du ikke om passordbytte? Del aldri koden og se bort fra meldingen."
  }
};

export function normalizeAuthEmailLocale(value: unknown): AuthEmailLocale {
  return value === "en" || value === "sv" || value === "no" ? value : "fi";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

export function createAuthEmail(input: AuthEmailInput) {
  const localeCopy = copy[input.locale];
  const message = localeCopy[input.kind];
  const [subject, title, body] = message;
  const buttonLabel = input.kind === "password-reset" ? message[3] : undefined;
  const code = input.code?.replace(/\D/g, "").slice(0, 8) ?? "";
  const actionUrl = input.actionUrl ? escapeHtml(input.actionUrl) : "";
  const actionText = buttonLabel && input.actionUrl
    ? `${buttonLabel}: ${input.actionUrl}`
    : code;

  const actionHtml = buttonLabel && actionUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#ff7817" style="border-radius:12px;box-shadow:0 8px 18px rgba(255,120,23,.22);"><a href="${actionUrl}" style="display:inline-block;padding:16px 28px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;line-height:20px;">${buttonLabel}&nbsp;&nbsp;&rarr;</a></td></tr></table>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="padding:16px 22px;border:1px solid #ffc79f;border-radius:13px;background:#fff8f2;color:#10243e;font-size:32px;font-weight:900;line-height:38px;letter-spacing:8px;box-shadow:0 7px 18px rgba(255,120,23,.10);">${escapeHtml(code)}</td></tr></table>`;
  const notice = securityNotice[input.locale][input.kind];

  return {
    subject,
    text: `${title}\n\n${body}\n\n${actionText}\n\n${localeCopy.expiry}\n\n${notice}\n\n${localeCopy.footer}`,
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:620px){.email-shell{padding:14px 8px!important}.email-card{border-radius:16px!important}.email-content{padding:30px 20px!important}.email-title{font-size:25px!important}.email-notice{margin-left:0!important;margin-right:0!important}}</style></head><body style="margin:0;padding:0;background:#eaf0f6;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(body)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eaf0f6"><tr><td class="email-shell" align="center" style="padding:34px 14px;font-family:Arial,Helvetica,sans-serif;color:#10243e;"><table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;overflow:hidden;border:1px solid #d9e3ed;border-radius:22px;background:#ffffff;box-shadow:0 20px 50px rgba(7,28,49,.11);"><tr><td align="center" bgcolor="#071c31" style="padding:27px 24px 24px;border-bottom:5px solid #ff7817;"><img src="https://maskines.com/maskines-email-logo.png" width="82" height="82" alt="Maskines" style="display:block;width:82px;height:82px;margin:0 auto 10px;border:0;border-radius:50%;"><div style="color:#ffffff;font-size:27px;font-weight:900;font-style:italic;line-height:32px;letter-spacing:.7px;">MASKINES</div><div style="margin-top:3px;color:#ff7817;font-size:10px;font-weight:800;line-height:14px;letter-spacing:4px;">MARKETPLACE</div></td></tr><tr><td class="email-content" align="center" style="padding:36px 34px 34px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center" valign="middle" style="width:58px;height:58px;border:1px solid #ffc79f;border-radius:17px;background:#fff7f1;color:#ff7817;font-size:27px;line-height:58px;">&#128274;</td></tr></table><h1 class="email-title" style="margin:24px 0 11px;color:#10243e;font-size:28px;font-weight:800;line-height:35px;letter-spacing:-.3px;">${title}</h1><p style="max-width:440px;margin:0 auto 25px;color:#5f7188;font-size:15px;line-height:24px;">${body}</p>${actionHtml}<p style="max-width:430px;margin:20px auto 0;color:#8796a9;font-size:12px;line-height:19px;">${localeCopy.expiry}</p><table role="presentation" class="email-notice" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border:1px solid #ffd0ad;border-radius:14px;background:#fff9f4;"><tr><td width="42" align="center" valign="middle" style="padding:15px 0 15px 12px;color:#ff7817;font-size:22px;font-weight:900;">&bull;</td><td style="padding:15px 18px 15px 5px;color:#725542;font-size:12px;line-height:19px;text-align:left;">${notice}</td></tr></table></td></tr><tr><td align="center" bgcolor="#f7f9fc" style="padding:21px 24px;border-top:1px solid #e1e8f0;color:#8292a7;font-size:11px;line-height:18px;">${localeCopy.footer}<br><strong style="color:#53677f;">&copy; Maskines</strong></td></tr></table></td></tr></table></body></html>`
  };
}
