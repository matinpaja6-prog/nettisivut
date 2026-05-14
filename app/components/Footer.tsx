"use client";

import Link from "next/link";
import { useLanguage, type Locale } from "@/lib/i18n";

const footerText = {
  fi: {
    tagline: "Pohjoisen paras varaosamarketpaikka moottorikelkoille, mönkijöille, motocrossille ja mopoille.",
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
  const year = new Date().getFullYear();
  const text = footerText[locale];

  return (
    <footer className="site-footer">
      <div className="footer-inner">

        {/* Brand */}
        <div className="footer-brand">
          <Link href="/" className="footer-logo" aria-label="Arctic Parts">
            <span className="footer-logo-icon">AP</span>
            <span className="footer-logo-text">
              <strong>Arctic</strong>
              <em>Parts</em>
            </span>
          </Link>
          <p className="footer-tagline">
            {text.tagline}
          </p>
          <div className="footer-socials" aria-label={text.follow}>
            <a href="https://instagram.com/arcticparts" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="https://facebook.com/arcticparts" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
            <a href="mailto:info@arcticparts.fi" aria-label={text.email}>
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
              <li><Link href="/sell">{text.sell}</Link></li>
              <li><Link href="/garage">{text.garage}</Link></li>
              <li><Link href="/rewards">{text.rewards}</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>{text.company}</h4>
            <ul>
              <li><Link href="/about">{text.about}</Link></li>
              <li><Link href="/contact">{text.contact}</Link></li>
              <li><Link href="/careers">{text.careers}</Link></li>
              <li><Link href="/blog">{text.blog}</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>{text.support}</h4>
            <ul>
              <li><Link href="/faq">{text.faq}</Link></li>
              <li><Link href="/safety">{text.safety}</Link></li>
              <li><Link href="/terms">{text.terms}</Link></li>
              <li><Link href="/privacy">{text.privacy}</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>{text.contact}</h4>
            <ul>
              <li><a href="mailto:info@arcticparts.fi">info@arcticparts.fi</a></li>
              <li><a href="https://instagram.com/arcticparts" target="_blank" rel="noopener noreferrer">Instagram</a></li>
              <li><a href="https://facebook.com/arcticparts" target="_blank" rel="noopener noreferrer">Facebook</a></li>
            </ul>
          </div>

        </div>
      </div>

      <div className="footer-bottom">
        <span>© {year} Arctic Parts Oy. {text.rights}</span>
        <span className="footer-bottom-links">
          <Link href="/terms">{text.terms}</Link>
          <Link href="/privacy">{text.privacy}</Link>
          <Link href="/cookies">{text.cookies}</Link>
        </span>
      </div>
    </footer>
  );
}
