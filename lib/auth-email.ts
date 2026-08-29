import "server-only";

import { buildInternationalEmail, escapeEmailHtml } from "@/lib/email-template";

export type AuthEmailLocale = "fi" | "en" | "sv" | "no";
export type AuthEmailKind =
  | "registration"
  | "login"
  | "password-reset"
  | "password-change"
  | "email-change";

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
    "email-change": ["Maskines – sähköpostin vaihtokoodi", "Vahvista uusi sähköpostiosoitteesi", "Syötä tämä vahvistuskoodi Maskines-palvelussa viimeistelläksesi sähköpostiosoitteen vaihdon."],
    expiry: "Koodi tai linkki vanhenee pian. Jos et pyytänyt tätä, voit jättää viestin huomiotta.",
    footer: "Tämä on automaattinen turvallisuusviesti Maskines-palvelusta."
  },
  en: {
    registration: ["Maskines – registration code", "Verify your email", "Enter this verification code in Maskines to finish your registration."],
    login: ["Maskines – sign-in code", "Verify your sign-in", "Enter this verification code in Maskines to continue signing in."],
    "password-reset": ["Maskines – reset your password", "Create a new password", "We received a request to change the password for your Maskines account.", "Change password"],
    "password-change": ["Maskines – password change code", "Change your password", "Enter this verification code in Maskines to continue changing your password."],
    "email-change": ["Maskines – email change code", "Verify your new email address", "Enter this verification code in Maskines to finish changing your email address."],
    expiry: "The code or link expires soon. If you did not request this, you can ignore this message.",
    footer: "This is an automated security message from Maskines."
  },
  sv: {
    registration: ["Maskines – registreringskod", "Bekräfta din e-post", "Ange den här verifieringskoden i Maskines för att slutföra registreringen."],
    login: ["Maskines – inloggningskod", "Bekräfta inloggningen", "Ange den här verifieringskoden i Maskines för att fortsätta logga in."],
    "password-reset": ["Maskines – byt lösenord", "Skapa ett nytt lösenord", "Vi fick en begäran om att byta lösenordet till ditt Maskines-konto.", "Byt lösenord"],
    "password-change": ["Maskines – kod för lösenordsbyte", "Byt ditt lösenord", "Ange den här verifieringskoden i Maskines för att fortsätta byta lösenord."],
    "email-change": ["Maskines – kod för e-postbyte", "Bekräfta din nya e-postadress", "Ange den här verifieringskoden i Maskines för att slutföra bytet av e-postadress."],
    expiry: "Koden eller länken upphör snart att gälla. Om du inte begärde detta kan du ignorera meddelandet.",
    footer: "Detta är ett automatiskt säkerhetsmeddelande från Maskines."
  },
  no: {
    registration: ["Maskines – registreringskode", "Bekreft e-posten din", "Skriv inn denne bekreftelseskoden i Maskines for å fullføre registreringen."],
    login: ["Maskines – innloggingskode", "Bekreft innloggingen", "Skriv inn denne bekreftelseskoden i Maskines for å fortsette innloggingen."],
    "password-reset": ["Maskines – tilbakestill passordet", "Opprett et nytt passord", "Vi mottok en forespørsel om å endre passordet til Maskines-kontoen din.", "Bytt passord"],
    "password-change": ["Maskines – kode for passordbytte", "Bytt passordet ditt", "Skriv inn denne bekreftelseskoden i Maskines for å fortsette passordbyttet."],
    "email-change": ["Maskines – kode for e-postendring", "Bekreft den nye e-postadressen", "Skriv inn denne bekreftelseskoden i Maskines for å fullføre endringen av e-postadresse."],
    expiry: "Koden eller lenken utløper snart. Hvis du ikke ba om dette, kan du se bort fra meldingen.",
    footer: "Dette er en automatisk sikkerhetsmelding fra Maskines."
  }
} as const;

const securityNotice: Record<AuthEmailLocale, Record<AuthEmailKind, string>> = {
  fi: {
    registration: "Etkö ollut rekisteröitymässä? Voit jättää tämän viestin huomiotta — tiliä ei vahvisteta ilman koodia.",
    login: "Etkö yrittänyt kirjautua? Älä jaa koodia kenellekään. Maskines ei koskaan kysy vahvistuskoodiasi.",
    "password-reset": "Etkö pyytänyt tätä? Salasanaasi ei ole muutettu. Voit turvallisesti jättää viestin huomiotta.",
    "password-change": "Etkö pyytänyt salasanan vaihtoa? Älä jaa koodia kenellekään ja jätä viesti huomiotta.",
    "email-change": "Etkö pyytänyt sähköpostiosoitteen vaihtoa? Älä jaa koodia kenellekään ja jätä viesti huomiotta."
  },
  en: {
    registration: "Didn’t start this registration? You can ignore this message — the account cannot be verified without the code.",
    login: "Didn’t try to sign in? Never share this code. Maskines will never ask you for your verification code.",
    "password-reset": "Didn’t request this? Your password has not been changed. You can safely ignore this message.",
    "password-change": "Didn’t request a password change? Never share this code and ignore this message.",
    "email-change": "Didn’t request an email change? Never share the code and ignore this message."
  },
  sv: {
    registration: "Påbörjade du inte registreringen? Du kan ignorera meddelandet — kontot kan inte bekräftas utan koden.",
    login: "Försökte du inte logga in? Dela aldrig koden. Maskines kommer aldrig att be dig om verifieringskoden.",
    "password-reset": "Begärde du inte detta? Ditt lösenord har inte ändrats. Du kan tryggt ignorera meddelandet.",
    "password-change": "Begärde du inte ett lösenordsbyte? Dela aldrig koden och ignorera meddelandet.",
    "email-change": "Begärde du inte ett byte av e-postadress? Dela aldrig koden och ignorera meddelandet."
  },
  no: {
    registration: "Startet du ikke registreringen? Du kan se bort fra meldingen — kontoen kan ikke bekreftes uten koden.",
    login: "Forsøkte du ikke å logge inn? Del aldri koden. Maskines vil aldri be deg om bekreftelseskoden.",
    "password-reset": "Ba du ikke om dette? Passordet ditt er ikke endret. Du kan trygt se bort fra meldingen.",
    "password-change": "Ba du ikke om passordbytte? Del aldri koden og se bort fra meldingen.",
    "email-change": "Ba du ikke om å endre e-postadressen? Del aldri koden og se bort fra meldingen."
  }
};

export function normalizeAuthEmailLocale(value: unknown): AuthEmailLocale {
  return value === "en" || value === "sv" || value === "no" ? value : "fi";
}

export function createAuthEmail(input: AuthEmailInput) {
  const localeCopy = copy[input.locale];
  const message = localeCopy[input.kind];
  const [subject, title, body] = message;
  const buttonLabel = input.kind === "password-reset" ? message[3] : undefined;
  const code = input.code?.replace(/\D/g, "").slice(0, 8) ?? "";
  const actionUrl = input.actionUrl ?? "";
  const actionText = buttonLabel && input.actionUrl
    ? `${buttonLabel}: ${input.actionUrl}`
    : code;

  const notice = securityNotice[input.locale][input.kind];
  return {
    subject,
    text: `${title}\n\n${body}\n\n${actionText}\n\n${localeCopy.expiry}\n\n${notice}\n\n${localeCopy.footer}`,
    html: buildInternationalEmail({
      locale: input.locale,
      preheader: body,
      title,
      lead: body,
      bodyHtml: buttonLabel && actionUrl
        ? `<p class="email-muted" style="margin:0;text-align:center;color:#8796a9;font-size:12px;line-height:19px;">${escapeEmailHtml(localeCopy.expiry)}</p>`
        : `<table class="email-panel" role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td class="email-strong email-panel" style="padding:16px 22px;border:1px solid #ffc79f;border-radius:13px;background:#fff8f2;color:#10243e;font-size:32px;font-weight:900;line-height:38px;letter-spacing:8px;text-align:center;">${escapeEmailHtml(code)}</td></tr></table><p class="email-muted" style="margin:18px 0 0;text-align:center;color:#8796a9;font-size:12px;line-height:19px;">${escapeEmailHtml(localeCopy.expiry)}</p>`,
      action: buttonLabel && actionUrl ? { label: buttonLabel, url: actionUrl } : undefined,
      notice
    })
  };
}
