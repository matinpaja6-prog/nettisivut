"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { useLanguage, type Locale } from "@/lib/i18n";
import { canonicalPathFromLocalized, pagePath } from "@/lib/routes";

const footerText = {
  fi: {
    tagline: "Pohjoismaiden paras varaosamarketpaikka moottorikelkoille, mönkijöille, motocrossille ja mopoille.",
    follow: "Seuraa meitä",
    email: "Sähköposti",
    service: "Palvelu",
    home: "Etusivu",
    sell: "Myy osa",
    garage: "Talli",
    rewards: "Palkinnot",
    company: "Yritys",
    about: "Meistä",
    contact: "Ota yhteyttä",
    careers: "Avoimet paikat",
    blog: "Blogi",
    support: "Tuki",
    faq: "UKK",
    safety: "Turvallinen kauppa",
    terms: "Käyttöehdot",
    privacy: "Tietosuoja",
    cookies: "Evästeet",
    rights: "Kaikki oikeudet pidätetään."
  },
  en: {
    tagline: "The northern marketplace for snowmobile, ATV, motocross and moped parts.",
    follow: "Follow us",
    email: "Email",
    service: "Service",
    home: "Home",
    sell: "Sell part",
    garage: "Garage",
    rewards: "Rewards",
    company: "Company",
    about: "About us",
    contact: "Contact",
    careers: "Careers",
    blog: "Blog",
    support: "Support",
    faq: "FAQ",
    safety: "Safe trading",
    terms: "Terms",
    privacy: "Privacy",
    cookies: "Cookies",
    rights: "All rights reserved."
  },
  sv: {
    tagline: "Nordens marknadsplats för delar till snöskotrar, fyrhjulingar, motocross och mopeder.",
    follow: "Följ oss",
    email: "E-post",
    service: "Tjänst",
    home: "Hem",
    sell: "Sälj del",
    garage: "Garage",
    rewards: "Belöningar",
    company: "Företag",
    about: "Om oss",
    contact: "Kontakt",
    careers: "Lediga jobb",
    blog: "Blogg",
    support: "Support",
    faq: "FAQ",
    safety: "Trygg handel",
    terms: "Villkor",
    privacy: "Integritet",
    cookies: "Cookies",
    rights: "Alla rättigheter förbehållna."
  },
  no: {
    tagline: "Den nordlige markedsplassen for deler til snøscootere, ATV-er, motocross og mopeder.",
    follow: "Følg oss",
    email: "E-post",
    service: "Tjeneste",
    home: "Hjem",
    sell: "Selg del",
    garage: "Garasje",
    rewards: "Belønninger",
    company: "Selskap",
    about: "Om oss",
    contact: "Kontakt",
    careers: "Ledige stillinger",
    blog: "Blogg",
    support: "Støtte",
    faq: "FAQ",
    safety: "Trygg handel",
    terms: "Vilkår",
    privacy: "Personvern",
    cookies: "Informasjonskapsler",
    rights: "Alle rettigheter reservert."
  },
  et: {
    tagline: "Põhjamaine turg mootorsaanide, ATV-de, motokrossi ja mopeedide varuosadele.",
    follow: "Jälgi meid",
    email: "E-post",
    service: "Teenused",
    home: "Avaleht",
    sell: "Müü osa",
    garage: "Garaaž",
    rewards: "Auhinnad",
    company: "Ettevõte",
    about: "Meist",
    contact: "Kontakt",
    careers: "Tööpakkumised",
    blog: "Blogi",
    support: "Tugi",
    faq: "KKK",
    safety: "Turvaline kauplemine",
    terms: "Tingimused",
    privacy: "Privaatsus",
    cookies: "Küpsised",
    rights: "Kõik õigused kaitstud."
  }
} satisfies Record<Locale, Record<string, string>>;

export default function Footer() {
  const { locale } = useLanguage();
  const pathname = usePathname();
  const year = new Date().getFullYear();
  const text = footerText[locale];
  const canonicalPathname = canonicalPathFromLocalized(pathname || "/");

  const hideFooter =
    canonicalPathname.startsWith("/auth") ||
    canonicalPathname.startsWith("/listing") ||
    canonicalPathname.startsWith("/messages") ||
    canonicalPathname.startsWith("/profile") ||
    canonicalPathname.startsWith("/privacy") ||
    canonicalPathname.startsWith("/terms");

  if (hideFooter) return null;

  return (
    <footer className="site-footer">
      <div className="footer-inner">

        {/* Brand */}
        <div className="footer-brand">
          <Link href="/" className="footer-logo" aria-label="Maskines">
            <svg
              className="footer-maskines-logo"
              viewBox="0 0 720 520"
              role="img"
              aria-label="Maskines"
            >
              <defs>
                <linearGradient id="footerMaskinesOrange" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ffb13b" />
                  <stop offset="48%" stopColor="#ff7a1a" />
                  <stop offset="100%" stopColor="#f05200" />
                </linearGradient>
                <linearGradient id="footerMaskinesDark" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f7fbff" />
                  <stop offset="48%" stopColor="#cbd7e2" />
                  <stop offset="100%" stopColor="#7f8d9d" />
                </linearGradient>
                <linearGradient id="footerMaskinesInk" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f9fcff" />
                  <stop offset="100%" stopColor="#d4e0ea" />
                </linearGradient>
                <linearGradient id="footerMaskinesGear" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2b3540" />
                  <stop offset="45%" stopColor="#141b24" />
                  <stop offset="100%" stopColor="#050910" />
                </linearGradient>
                <linearGradient id="footerMaskinesGearEdge" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ff9b2a" />
                  <stop offset="100%" stopColor="#061827" />
                </linearGradient>
                <linearGradient id="footerMaskinesUnderline" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0" />
                  <stop offset="20%" stopColor="#ff8a1c" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="#ffb14a" stopOpacity="1" />
                  <stop offset="80%" stopColor="#ff7a1a" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
                </linearGradient>
                <filter id="footerMaskinesGlow" x="-20%" y="-24%" width="140%" height="150%">
                  <feDropShadow dx="0" dy="16" stdDeviation="13" floodColor="#000814" floodOpacity="0.56" />
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#ff7a1a" floodOpacity="0.22" />
                </filter>
                <filter id="footerMaskinesTextShadow" x="-20%" y="-40%" width="140%" height="180%">
                  <feDropShadow dx="0" dy="9" stdDeviation="5" floodColor="#000814" floodOpacity="0.62" />
                  <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#7dd3fc" floodOpacity="0.18" />
                </filter>
              </defs>
              <g transform="translate(162 24)">
                <path
                  d="M0 18 L180 132 L180 214 L74 146 L74 336 L0 286 Z"
                  fill="url(#footerMaskinesOrange)"
                />
                <path
                  d="M32 72 L150 147 L150 176 L58 118 L58 300 L32 282 Z"
                  fill="#ffad36"
                  opacity="0.28"
                />
                <path
                  d="M18 48 L166 142"
                  fill="none"
                  opacity="0.42"
                  stroke="#ffd29a"
                  strokeLinecap="round"
                  strokeWidth="7"
                />
                <path
                  d="M396 18 L216 132 L216 214 L322 146 L322 336 L396 286 Z"
                  fill="url(#footerMaskinesDark)"
                />
                <path
                  d="M364 72 L246 147 L246 176 L338 118 L338 300 L364 282 Z"
                  fill="#ffffff"
                  opacity="0.18"
                />
                <path
                  d="M378 48 L230 142"
                  fill="none"
                  opacity="0.36"
                  stroke="#ffffff"
                  strokeLinecap="round"
                  strokeWidth="7"
                />
                <g transform="translate(198 222)">
                  <path
                    d="M-24 -92 H24 L30 -62
                       A66 66 0 0 1 56 -47
                       L86 -58 L110 -17 L85 1
                       A66 66 0 0 1 85 31
                       L110 49 L86 90 L56 79
                       A66 66 0 0 1 30 94
                       L24 124 H-24 L-30 94
                       A66 66 0 0 1 -56 79
                       L-86 90 L-110 49 L-85 31
                       A66 66 0 0 1 -85 1
                       L-110 -17 L-86 -58 L-56 -47
                       A66 66 0 0 1 -30 -62 Z
                       M0 -56
                       A56 56 0 1 0 0 56
                       A56 56 0 1 0 0 -56
                       M0 -25
                       A25 25 0 1 1 0 25
                       A25 25 0 1 1 0 -25"
                    fill="url(#footerMaskinesGear)"
                    fillRule="evenodd"
                    stroke="url(#footerMaskinesGearEdge)"
                    strokeOpacity="0.62"
                    strokeWidth="5"
                  />
                  <path
                    d="M-58 -3 A58 58 0 0 0 58 -3"
                    fill="none"
                    opacity="0.78"
                    stroke="#ff8a1c"
                    strokeLinecap="round"
                    strokeWidth="7"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    fill="#07111d"
                    r="25"
                    stroke="#dce8f4"
                    strokeOpacity="0.28"
                    strokeWidth="5"
                  />
                  <path
                    d="M-39 -31 A50 50 0 0 1 39 -31"
                    fill="none"
                    opacity="0.28"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeWidth="5"
                  />
                </g>
              </g>
              <text
                x="360"
                y="474"
                textAnchor="middle"
                fill="url(#footerMaskinesInk)"
                fontFamily="Arial Black, Impact, system-ui, sans-serif"
                fontSize="118"
                fontStyle="italic"
                fontWeight="900"
                letterSpacing="-9"
                paintOrder="stroke fill"
                stroke="#07111d"
                strokeLinejoin="round"
                strokeWidth="9"
                transform="skewX(-7 360 472)"
              >
                maskines
              </text>
              <path
                d="M133 493 H587"
                stroke="url(#footerMaskinesUnderline)"
                strokeLinecap="round"
                strokeWidth="6"
              />
            </svg>
          </Link>
          <p className="footer-tagline">
            {text.tagline}
          </p>
          <div className="footer-socials" aria-label={text.follow}>
            <a href="https://www.instagram.com/maskines1/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61590753577719&locale=fi_FI" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
            <a href="mailto:info@maskines.com" aria-label={text.email}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </a>
          </div>
        </div>

        {/* Links */}
        <div className="footer-links-grid">

          <div className="footer-col">
            <h4>{text.service}</h4>
            <ul>
              <li><Link href="/">{text.home}</Link></li>
              <li><Link href={pagePath("sell", locale)}>{text.sell}</Link></li>
              <li><Link href={pagePath("garage", locale)}>{text.garage}</Link></li>
              {FEATURE_FLAGS.rewardsAndShop ? <li><Link href={pagePath("rewards", locale)}>{text.rewards}</Link></li> : null}
            </ul>
          </div>

          <div className="footer-col">
            <h4>{text.company}</h4>
            <ul>
              <li><Link href={pagePath("about", locale)}>{text.about}</Link></li>
              <li><Link href={pagePath("contact", locale)}>{text.contact}</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>{text.support}</h4>
            <ul>
              <li><Link href={pagePath("faq", locale)}>{text.faq}</Link></li>
              <li><Link href={pagePath("safety", locale)}>{text.safety}</Link></li>
              <li><Link href={pagePath("terms", locale)}>{text.terms}</Link></li>
              <li><Link href={pagePath("privacy", locale)}>{text.privacy}</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>{text.contact}</h4>
            <ul>
              <li><a href="mailto:info@maskines.com">info@maskines.com</a></li>
              <li><a href="https://www.instagram.com/maskines1/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
              <li><a href="https://www.facebook.com/profile.php?id=61590753577719&locale=fi_FI" target="_blank" rel="noopener noreferrer">Facebook</a></li>
            </ul>
          </div>

        </div>
      </div>

      <div className="footer-bottom">
        <span>© {year} Maskines. {text.rights}</span>
        <span className="footer-bottom-links">
          <Link href={pagePath("terms", locale)}>{text.terms}</Link>
          <Link href={pagePath("privacy", locale)}>{text.privacy}</Link>
          <Link href={pagePath("cookies", locale)}>{text.cookies}</Link>
        </span>
      </div>
    </footer>
  );
}
