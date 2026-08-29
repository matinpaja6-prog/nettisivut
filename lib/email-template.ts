import "server-only";

import { MASKINES_EMAIL_LOGOS, MASKINES_EMAIL_THEME_HEAD } from "@/lib/email-brand";
import { absoluteSiteUrl } from "@/lib/site-url";

export type EmailLocale = "fi" | "en" | "sv" | "no";

const commonCopy = {
  fi: { secure: "MASKINES-TILI", sent: "Lähetetty turvallisesti Maskines-palvelusta", help: "Ohjekeskus", privacy: "Tietosuoja" },
  en: { secure: "MASKINES ACCOUNT", sent: "Sent securely by Maskines", help: "Help Center", privacy: "Privacy" },
  sv: { secure: "MASKINES-KONTO", sent: "Säkert skickat av Maskines", help: "Hjälpcenter", privacy: "Integritet" },
  no: { secure: "MASKINES-KONTO", sent: "Sendt sikkert av Maskines", help: "Hjelpesenter", privacy: "Personvern" }
} as const;

export function normalizeEmailLocale(value: unknown): EmailLocale {
  return value === "en" || value === "sv" || value === "no" ? value : "fi";
}

export function emailLocaleTag(locale: EmailLocale) {
  return locale === "no" ? "nb-NO" : locale === "fi" ? "fi-FI" : locale === "sv" ? "sv-SE" : "en-US";
}

export function escapeEmailHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildInternationalEmail(input: {
  locale: EmailLocale;
  preheader: string;
  eyebrow?: string;
  title: string;
  lead: string;
  bodyHtml?: string;
  action?: { label: string; url: string };
  notice?: string;
  footerHtml?: string;
}) {
  const common = commonCopy[input.locale];
  const lang = input.locale === "no" ? "nb" : input.locale;
  const eyebrow = input.eyebrow || common.secure;
  const helpUrl = absoluteSiteUrl("/faq");
  const privacyUrl = absoluteSiteUrl("/privacy");

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeEmailHtml(input.title)}</title>
  ${MASKINES_EMAIL_THEME_HEAD}
</head>
<body class="email-bg" style="margin:0;padding:0;background:#eef3f7;color:#10243e;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeEmailHtml(input.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table class="email-bg" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef3f7" style="width:100%;border-collapse:collapse;background:#eef3f7;">
    <tr><td class="email-shell" align="center" style="padding:30px 14px 38px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" class="email-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;overflow:hidden;border:1px solid #d8e2eb;border-radius:22px;background:#ffffff;box-shadow:0 18px 48px rgba(16,36,62,.10);">
        <tr><td class="email-header email-brand-header" align="center" bgcolor="#202124" style="padding:26px 24px 23px;border-bottom:4px solid #ff7417;background:#202124;">
          ${MASKINES_EMAIL_LOGOS}
        </td></tr>
        <tr><td class="email-content" align="center" style="padding:38px 38px 34px;">
          <span style="display:inline-block;padding:9px 16px;border-radius:999px;background:#10243e;color:#ffffff;font-size:11px;font-weight:800;line-height:14px;letter-spacing:1.35px;">${escapeEmailHtml(eyebrow)}</span>
          <h1 class="email-title" style="margin:25px 0 11px;color:#10243e;font-size:31px;font-weight:850;line-height:38px;letter-spacing:-.45px;">${escapeEmailHtml(input.title)}</h1>
          <p class="email-copy" style="max-width:470px;margin:0 auto;color:#60738a;font-size:15px;line-height:24px;">${escapeEmailHtml(input.lead)}</p>
          ${input.bodyHtml ? `<div style="margin-top:25px;width:100%;text-align:left;">${input.bodyHtml}</div>` : ""}
          ${input.action ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-top:27px;"><tr><td bgcolor="#ff7417" style="border-radius:12px;"><a class="email-action" href="${escapeEmailHtml(input.action.url)}" style="display:inline-block;padding:16px 28px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;line-height:20px;">${escapeEmailHtml(input.action.label)}&nbsp;&nbsp;&rarr;</a></td></tr></table>` : ""}
          ${input.notice ? `<table class="email-notice" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border:1px solid #ffd0ad;border-radius:14px;background:#fff9f4;"><tr><td width="42" align="center" valign="top" style="padding:16px 0 16px 12px;color:#ff7417;font-size:21px;font-weight:900;">&#10003;</td><td class="email-notice" style="padding:16px 18px 16px 6px;color:#6c5645;font-size:12px;line-height:19px;text-align:left;">${escapeEmailHtml(input.notice)}</td></tr></table>` : ""}
        </td></tr>
        <tr><td class="email-footer" align="center" style="padding:22px 24px;border-top:1px solid #e1e8ef;background:#f8fafc;color:#8090a3;font-size:11px;line-height:19px;">
          ${escapeEmailHtml(common.sent)}<br>
          <a href="${escapeEmailHtml(helpUrl)}" style="color:#345477;text-decoration:none;">${escapeEmailHtml(common.help)}</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="${escapeEmailHtml(privacyUrl)}" style="color:#345477;text-decoration:none;">${escapeEmailHtml(common.privacy)}</a>
          ${input.footerHtml ? `<div style="margin-top:8px;">${input.footerHtml}</div>` : ""}
          <div style="margin-top:7px;color:#60738a;font-weight:700;">&copy; ${new Date().getUTCFullYear()} Maskines</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
