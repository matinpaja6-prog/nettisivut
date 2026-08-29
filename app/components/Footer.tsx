"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage, type Locale } from "@/lib/i18n";
import { canonicalPathFromLocalized, pagePath } from "@/lib/routes";
import MaskinesWordmark from "./MaskinesWordmark";

const footerText = {
  fi: {
    tagline: "Pohjoismainen markkinapaikka pienkoneiden varaosille ja ajoneuvoille.\nOsta ja myy moottorikelkat, mönkijät, motocross-pyörät, mopot ja niiden varaosat helposti samassa paikassa.",
    follow: "Seuraa meitä",
    email: "Sähköposti",
    service: "Palvelut",
    home: "Etusivu",
    listings: "Kaikki ilmoitukset",
    vehicles: "Ajoneuvot",
    parts: "Varaosat",
    sell: "Myy osa",
    garage: "Talli",
    shop: "Yrityskauppa",
    company: "Yritys",
    about: "Meistä",
    contact: "Ota yhteyttä",
    contactHeading: "Yhteystiedot",
    careers: "Avoimet paikat",
    blog: "Blogi",
    support: "Tuki",
    faq: "UKK",
    safety: "Turvallinen kauppa",
    terms: "Käyttöehdot",
    privacy: "Tietosuoja",
    cookies: "Evästeet",
    responsibility: "Maskines tarjoaa markkinapaikan ja vastaa omasta alustapalvelustaan. Ilmoituksessa nimetty myyjä vastaa tuotteesta, sen kunnosta, toimituksesta, palautuksista ja hyvityksistä.",
    rights: "Kaikki oikeudet pidätetään."
  },
  en: {
    tagline: "A Nordic marketplace for small vehicles and spare parts.\nBuy and sell snowmobiles, ATVs, motocross bikes, mopeds and their spare parts in one place.",
    follow: "Follow us",
    email: "Email",
    service: "Service",
    home: "Home",
    listings: "All listings",
    vehicles: "Vehicles",
    parts: "Spare parts",
    sell: "Sell part",
    garage: "Garage",
    shop: "Company shop",
    company: "Company",
    about: "About us",
    contact: "Contact",
    contactHeading: "Contact details",
    careers: "Careers",
    blog: "Blog",
    support: "Support",
    faq: "FAQ",
    safety: "Safe trading",
    terms: "Terms of Use",
    privacy: "Privacy",
    cookies: "Cookies",
    responsibility: "Maskines provides the marketplace and is responsible for its own platform service. The seller identified in the listing is responsible for the product, its condition, delivery, returns and refunds.",
    rights: "All rights reserved."
  },
  sv: {
    tagline: "En nordisk marknadsplats för småfordon och reservdelar.\nKöp och sälj snöskotrar, fyrhjulingar, motocrosscyklar, mopeder och deras reservdelar på samma ställe.",
    follow: "Följ oss",
    email: "E-post",
    service: "Tjänst",
    home: "Hem",
    listings: "Alla annonser",
    vehicles: "Fordon",
    parts: "Reservdelar",
    sell: "Sälj del",
    garage: "Garage",
    shop: "Företagsbutik",
    company: "Företag",
    about: "Om oss",
    contact: "Kontakt",
    contactHeading: "Kontaktuppgifter",
    careers: "Lediga jobb",
    blog: "Blogg",
    support: "Support",
    faq: "FAQ",
    safety: "Trygg handel",
    terms: "Användarvillkor",
    privacy: "Integritet",
    cookies: "Cookies",
    responsibility: "Maskines tillhandahåller marknadsplatsen och ansvarar för sin egen plattformstjänst. Säljaren i annonsen ansvarar för produkten, dess skick, leverans, returer och återbetalningar.",
    rights: "Alla rättigheter förbehållna."
  },
  no: {
    tagline: "En nordisk markedsplass for små kjøretøy og reservedeler.\nKjøp og selg snøscootere, ATV-er, motocrossykler, mopeder og reservedeler på samme sted.",
    follow: "Følg oss",
    email: "E-post",
    service: "Tjeneste",
    home: "Hjem",
    listings: "Alle annonser",
    vehicles: "Kjøretøy",
    parts: "Reservedeler",
    sell: "Selg del",
    garage: "Garasje",
    shop: "Bedriftsbutikk",
    rewards: "Belønninger",
    company: "Selskap",
    about: "Om oss",
    contact: "Kontakt",
    contactHeading: "Kontaktinformasjon",
    careers: "Ledige stillinger",
    blog: "Blogg",
    support: "Støtte",
    faq: "FAQ",
    safety: "Trygg handel",
    terms: "Brukervilkår",
    privacy: "Personvern",
    cookies: "Informasjonskapsler",
    responsibility: "Maskines tilbyr markedsplassen og er ansvarlig for sin egen plattformstjeneste. Selgeren i annonsen er ansvarlig for produktet, tilstand, levering, returer og refusjoner.",
    rights: "Alle rettigheter reservert."
  },
} satisfies Record<Locale, Record<string, string>>;

export default function Footer() {
  const { locale } = useLanguage();
  const pathname = usePathname();
  const year = new Date().getFullYear();
  const text = footerText[locale];
  const canonicalPathname = canonicalPathFromLocalized(pathname || "/");

  // Keep the global footer visible throughout the application. Authentication
  // screens are the only exception because they intentionally use a compact shell.
  const hideFooter = canonicalPathname.startsWith("/auth");

  if (hideFooter) return null;

  return (
    <footer className="site-footer" data-no-auto-translate>
      <div className="footer-inner">

        {/* Brand */}
        <div className="footer-brand">
          <Link href="/" className="footer-logo" aria-label="Maskines">
            <span className="footer-maskines-logo-new" aria-hidden="true">
              <img className="footer-maskines-mark-light" src="/maskines-brand-mark-clean-v4.png" alt="" />
              <img className="footer-maskines-mark-dark" src="/maskines-brand-mark-dark-clean-v4.png" alt="" />
              <MaskinesWordmark className="footer-maskines-wordmark" />
            </span>
          </Link>
          <p className="footer-tagline" style={{ whiteSpace: "pre-line" }}>
            {text.tagline}
          </p>
          <div className="footer-socials" aria-label={text.follow}>
            <a href="https://www.instagram.com/maskines1/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61590753577719&locale=fi_FI" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
            <a href="https://www.tiktok.com/@maskines.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4v10.5a4.5 4.5 0 1 1-3.7-4.43"/><path d="M15 4c.63 2.35 2.05 3.77 4 4"/></svg>
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
              <li><Link href="/ilmoitukset">{text.listings}</Link></li>
              <li><Link href="/ajoneuvot">{text.vehicles}</Link></li>
              <li><Link href="/varaosat">{text.parts}</Link></li>
              <li><Link href={pagePath("sell", locale)}>{text.sell}</Link></li>
              <li><Link href={pagePath("garage", locale)}>{text.garage}</Link></li>
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
            <h4>{text.contactHeading}</h4>
            <ul>
              <li><a href="mailto:info@maskines.com">info@maskines.com</a></li>
              <li><a href="https://www.instagram.com/maskines1/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
              <li><a href="https://www.facebook.com/profile.php?id=61590753577719&locale=fi_FI" target="_blank" rel="noopener noreferrer">Facebook</a></li>
            </ul>
          </div>

        </div>
      </div>

      <div className="footer-responsibility">
        <p>{text.responsibility} <Link href={pagePath("terms", locale)}>{text.terms}</Link>.</p>
      </div>

      <div className="footer-bottom">
        <span>© {year} Maskines. {text.rights}</span>
        <span className="footer-bottom-links">
          <Link href={pagePath("terms", locale)}>{text.terms}</Link>
          <Link href={pagePath("privacy", locale)}>{text.privacy}</Link>
          <Link href={pagePath("cookies", locale)}>{text.cookies}</Link>
        </span>
      </div>
      <style jsx>{`
        .footer-responsibility {
          border-top: 1px solid rgba(148, 163, 184, 0.16);
          margin: 0 auto;
          max-width: 1220px;
          padding: 16px 24px 0;
          width: 100%;
        }
        .footer-responsibility p {
          color: rgba(203, 213, 225, 0.72);
          font-size: 11px;
          line-height: 1.55;
          margin: 0;
          max-width: 900px;
        }
        .footer-responsibility a {
          color: inherit;
          font-weight: 850;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
      `}</style>
    </footer>
  );
}
