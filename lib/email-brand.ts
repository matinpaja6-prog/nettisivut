import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export const EMAIL_BRAND_CONTENT_ID = "maskines-email-brand";
export const EMAIL_BRAND_FILENAME = "maskines-email-brand-light-clean-v4.png";
export const EMAIL_BRAND_DARK_CONTENT_ID = "maskines-email-brand-dark";
export const EMAIL_BRAND_DARK_FILENAME = "maskines-email-brand-dark-clean-v4.png";

const EMAIL_BRAND_ASSET = `cid:${EMAIL_BRAND_CONTENT_ID}`;
const EMAIL_BRAND_DARK_ASSET = `cid:${EMAIL_BRAND_DARK_CONTENT_ID}`;
const LEGACY_EMAIL_BRAND_ASSETS = [
  "https://maskines.com/maskines-email-logo.png",
  "https://maskines.com/maskines-email-brand-v2.png",
  "https://maskines.com/maskines-email-brand-light-v3.png",
  "https://maskines.com/maskines-email-brand-light-clean-v4.png",
  "https://maskines.com/maskines-email-brand-dark-clean-v4.png"
];

export const MASKINES_EMAIL_THEME_HEAD = `
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style data-maskines-email-theme="true">
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  .email-brand-header { background:#202124 !important; }
  .maskines-logo-light { display:none !important; max-height:0 !important; overflow:hidden !important; mso-hide:all; }
  .maskines-logo-dark { display:block !important; max-height:none !important; overflow:visible !important; }
  @media only screen and (max-width:620px) {
    .email-shell { padding:12px 7px !important; }
    .email-card { border-radius:16px !important; }
    .email-header { padding:22px 18px !important; }
    .email-content { padding:30px 20px !important; }
    .email-title { font-size:27px !important; line-height:34px !important; }
    .email-action { display:block !important; text-align:center !important; }
  }
  @media only screen and (min-width:621px) {
    .email-brand-header { background:#ffffff !important; }
    .maskines-logo-dark { display:none !important; max-height:0 !important; overflow:hidden !important; mso-hide:all; }
    .maskines-logo-light { display:block !important; max-height:none !important; overflow:visible !important; }
  }
  @media only screen and (max-width:620px) and (prefers-color-scheme:dark) {
    body.email-bg, table.email-bg, td.email-bg { background:#07111d !important; color:#f7fafc !important; }
    .email-card { background:#111f2d !important; border-color:#2b4054 !important; box-shadow:none !important; }
    .email-header { background:#202124 !important; border-color:#ff7417 !important; }
    .email-content { background:#111f2d !important; }
    .email-title, .email-heading, .email-strong { color:#f7fafc !important; }
    .email-copy { color:#b8c7d6 !important; }
    .email-muted { color:#91a4b7 !important; }
    .email-panel { background:#172838 !important; border-color:#31475b !important; color:#c5d1dd !important; }
    .email-notice { background:#271f1b !important; border-color:#7a461f !important; color:#e8c9b2 !important; }
    .email-status-approved { background:#132c22 !important; border-color:#2e6848 !important; }
    .email-status-rejected { background:#301d21 !important; border-color:#78404a !important; }
    .email-footer { background:#0b1825 !important; border-color:#263b4f !important; color:#91a4b7 !important; }
    .email-footer a { color:#b8c7d6 !important; }
    body.email-bg [style*="background:#fff"], body.email-bg [style*="background: #fff"],
    body.email-bg [style*="background:#eaf2ff"], body.email-bg [style*="background:#f7f9"],
    body.email-bg [style*="background:#f8fa"], body.email-bg [style*="background:#f3f6"] { background-color:#172838 !important; }
    body.email-bg [style*="color:#172433"], body.email-bg [style*="color:#181818"],
    body.email-bg [style*="color:#142033"], body.email-bg [style*="color:#101827"],
    body.email-bg [style*="color:#0f172a"], body.email-bg [style*="color:#10243e"] { color:#f7fafc !important; }
    body.email-bg [style*="color:#52677a"], body.email-bg [style*="color:#64748b"],
    body.email-bg [style*="color:#667085"], body.email-bg [style*="color:#5f6d78"],
    body.email-bg [style*="color:#60738a"], body.email-bg [style*="color:#718399"] { color:#b8c7d6 !important; }
    .maskines-logo-light { display:none !important; max-height:0 !important; overflow:hidden !important; }
    .maskines-logo-dark { display:block !important; max-height:none !important; overflow:visible !important; }
  }
  [data-ogsc] body.email-bg, [data-ogsc] table.email-bg, [data-ogsc] td.email-bg { background:#07111d !important; color:#f7fafc !important; }
  [data-ogsc] .email-card { background:#111f2d !important; border-color:#2b4054 !important; box-shadow:none !important; }
  [data-ogsc] .email-header { background:#202124 !important; }
  [data-ogsc] .email-content { background:#111f2d !important; }
  [data-ogsc] .email-title, [data-ogsc] .email-heading, [data-ogsc] .email-strong { color:#f7fafc !important; }
  [data-ogsc] .email-copy { color:#b8c7d6 !important; }
  [data-ogsc] .email-muted { color:#91a4b7 !important; }
  [data-ogsc] .email-panel { background:#172838 !important; border-color:#31475b !important; color:#c5d1dd !important; }
  [data-ogsc] .email-notice { background:#271f1b !important; border-color:#7a461f !important; color:#e8c9b2 !important; }
  [data-ogsc] .email-footer { background:#0b1825 !important; border-color:#263b4f !important; color:#91a4b7 !important; }
  [data-ogsc] .maskines-logo-light { display:none !important; max-height:0 !important; overflow:hidden !important; }
  [data-ogsc] .maskines-logo-dark { display:block !important; max-height:none !important; overflow:visible !important; }
</style>`;

/**
 * Gmail for iOS does not reliably honor prefers-color-scheme or display swaps
 * for CID images. Keep one transparent, light-on-dark logo on a fixed dark
 * plate instead. It stays readable in both themes and cannot produce the
 * white bitmap rectangle shown by Gmail's automatic dark mode.
 */
export const MASKINES_EMAIL_LOGOS = `<!--[if !mso]><!--><img data-maskines-email-brand="true" class="maskines-logo-light" src="${EMAIL_BRAND_ASSET}" width="320" height="78" alt="Maskines" style="display:none;width:100%;max-width:320px;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;max-height:0;overflow:hidden;background:#ffffff;"><!--<![endif]--><img data-maskines-email-brand="true" class="maskines-logo-dark" src="${EMAIL_BRAND_DARK_ASSET}" width="320" height="78" alt="Maskines" style="display:block;width:100%;max-width:320px;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;background:#202124;">`;

const emailBrandHeader = `
<table class="email-card" data-maskines-email-brand="true" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#ffffff;">
  <tr>
    <td class="email-header email-brand-header" align="center" bgcolor="#202124" style="padding:22px 18px;border-bottom:4px solid #ff7417;background:#202124;">
      ${MASKINES_EMAIL_LOGOS}
    </td>
  </tr>
</table>`;

/** Adds the shared responsive light/dark email behavior without a brand header. */
export function withMaskinesEmailTheme(html: string) {
  let normalizedHtml = /<html\b/i.test(html)
    ? html
    : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="email-bg" style="margin:0;padding:0;background:#eef3f7;">${html}</body></html>`;

  normalizedHtml = normalizedHtml.replace(/<body\b([^>]*)>/i, (match, attributes: string) => {
    if (/\bclass=/i.test(attributes)) {
      return match.replace(/\bclass=(["'])(.*?)\1/i, (_classMatch, quote: string, classes: string) =>
        `class=${quote}${classes.includes("email-bg") ? classes : `${classes} email-bg`}${quote}`
      );
    }
    return `<body class="email-bg"${attributes}>`;
  });

  if (!normalizedHtml.includes('data-maskines-email-theme="true"')) {
    normalizedHtml = /<\/head>/i.test(normalizedHtml)
      ? normalizedHtml.replace(/<\/head>/i, `${MASKINES_EMAIL_THEME_HEAD}</head>`)
      : `${MASKINES_EMAIL_THEME_HEAD}${normalizedHtml}`;
  }

  return normalizedHtml;
}

/** Adds the production MASKINES lockup to branded service and marketing emails once. */
export function withMaskinesEmailBrand(html: string) {
  let normalizedHtml = LEGACY_EMAIL_BRAND_ASSETS.reduce(
    (currentHtml, asset) => currentHtml.replaceAll(asset, EMAIL_BRAND_ASSET),
    withMaskinesEmailTheme(html)
  );

  normalizedHtml = normalizedHtml.replace(
    /<img\b(?=[^>]*\bsrc=["']cid:maskines-email-brand["'])[^>]*>/gi,
    (match) => match.includes("maskines-logo-light") ? match : MASKINES_EMAIL_LOGOS
  );

  if (
    normalizedHtml.includes("data-maskines-email-brand") ||
    normalizedHtml.includes(EMAIL_BRAND_ASSET) ||
    normalizedHtml.includes(EMAIL_BRAND_DARK_ASSET)
  ) {
    return normalizedHtml;
  }

  const bodyTag = /<body\b[^>]*>/i;
  if (bodyTag.test(normalizedHtml)) {
    return normalizedHtml.replace(bodyTag, (match) => `${match}${emailBrandHeader}`);
  }

  return `${emailBrandHeader}${normalizedHtml}`;
}

export async function prepareMaskinesEmailBrand(html: string) {
  const emailBrandContent = readFile(
    path.join(process.cwd(), "public", EMAIL_BRAND_FILENAME)
  );
  const emailBrandDarkContent = readFile(
    path.join(process.cwd(), "public", EMAIL_BRAND_DARK_FILENAME)
  );

  return {
    html: withMaskinesEmailBrand(html),
    attachments: [
      {
        filename: EMAIL_BRAND_FILENAME,
        content: await emailBrandContent,
        contentType: "image/png",
        contentId: EMAIL_BRAND_CONTENT_ID
      },
      {
        filename: EMAIL_BRAND_DARK_FILENAME,
        content: await emailBrandDarkContent,
        contentType: "image/png",
        contentId: EMAIL_BRAND_DARK_CONTENT_ID
      }
    ]
  };
}
