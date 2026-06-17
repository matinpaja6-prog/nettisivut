"use client";

import Link from "next/link";
import { useLanguage, type Locale } from "@/lib/i18n";

type LegalCopy = {
  title: string;
  updated: string;
  terms: string;
  summaryLabel: string;
  summary: Array<{ title: string; text: string }>;
  sections: Array<{ title: string; body: string[]; bullets?: string[]; links?: Array<{ href: string; label: string }> }>;
};

const fiCopy: LegalCopy = {
  title: "Tietosuojaseloste",
  updated: "Päivitetty 14.5.2026 · EU GDPR -yhteensopiva seloste",
  terms: "Käyttöehdot",
  summaryLabel: "Tietosuojan tiivistelmä",
  summary: [
    { title: "Tietoja käytetään palvelun toimintaan", text: "Käsittelemme tietoja tilin, ilmoitusten, viestien ja turvallisen kaupankäynnin mahdollistamiseksi." },
    { title: "Säilytysajat on rajattu", text: "Tietoja säilytetään vain niin kauan kuin palvelu, laki tai väärinkäytösten selvittäminen edellyttää." },
    { title: "Tietoja ei myydä", text: "Emme myy henkilötietoja. Palveluntarjoajia käytetään vain palvelun toteuttamiseen." },
    { title: "GDPR-oikeudet kuuluvat sinulle", text: "Voit pyytää pääsyä tietoihin, korjausta, poistoa, rajoittamista, siirtoa tai vastustaa käsittelyä." }
  ],
  sections: [
    { title: "1. Rekisterinpitäjä", body: ["Rekisterinpitäjä on Arctic Parts Oy. Tietosuoja-asioissa voit ottaa yhteyttä osoitteeseen info@arcticparts.fi.", "Y-tunnus ja postiosoite täydennetään palveluun, kun yritystiedot vahvistetaan julkaisuun."] },
    { title: "2. Kerättävät tiedot", body: ["Keräämme vain palvelun kannalta tarpeellisia tietoja."], bullets: ["tilin perustiedot, kuten nimi, sähköposti, puhelinnumero ja sijainti", "yritystilin tiedot, kuten yrityksen nimi ja y-tunnus", "ilmoitusten kuvat, hinnat, varaosatiedot, kuvaukset ja sijainnit", "viestit, arvostelut, ilmoitukset ja turvallisuuteen liittyvät lokitiedot"] },
    { title: "3. Käyttötarkoitukset", body: ["Tietoja käytetään käyttäjätilin ylläpitoon, ilmoitusten julkaisuun, ostajan ja myyjän yhteydenpitoon, asiakastukeen, turvallisuuteen, väärinkäytösten estoon ja palvelun kehittämiseen."] },
    { title: "4. Oikeusperuste", body: ["Käsittely perustuu sopimuksen toteuttamiseen, lakisääteisiin velvoitteisiin, oikeutettuun etuun palvelun turvallisuuden vuoksi sekä suostumukseen silloin, kun suostumusta erikseen pyydetään."] },
    { title: "5. EU:n yleinen tietosuoja-asetus (GDPR)", body: ["Maskines käsittelee henkilötietoja GDPR:n periaatteiden mukaisesti: lainmukaisesti, kohtuullisesti, läpinäkyvästi ja vain määriteltyihin tarkoituksiin."], bullets: ["tietojen minimointi", "säilytyksen rajoittaminen", "eheys ja luottamuksellisuus", "osoitusvelvollisuus"] },
    { title: "6. Säilytysajat", body: ["Käyttäjätilin tiedot säilytetään tilin voimassaolon ajan. Poiston jälkeen tiedot poistetaan tai anonymisoidaan kohtuullisessa ajassa, ellei laki, riita tai väärinkäytösten selvittäminen edellytä pidempää säilytystä."] },
    { title: "7. Vastaanottajat ja siirrot", body: ["Emme myy henkilötietoja. Tietoja voidaan käsitellä teknisten palveluntarjoajien, kuten tietokanta-, kirjautumis-, maksu-, sähköposti- tai ylläpitopalveluiden kautta. Jos tietoja siirretään EU/ETA-alueen ulkopuolelle, käytämme GDPR:n mukaisia suojakeinoja."] },
    { title: "8. Rekisteröidyn oikeudet", body: ["Sinulla on oikeus saada pääsy tietoihin, korjata virheellisiä tietoja, pyytää poistamista, rajoittaa käsittelyä, vastustaa käsittelyä ja saada tietyt tiedot koneellisesti luettavassa muodossa. Lähetä pyyntö osoitteeseen info@arcticparts.fi."] },
    { title: "9. Valitusoikeus ja lisätieto", body: ["Jos katsot, että henkilötietojasi käsitellään lainvastaisesti, voit olla yhteydessä Maskinesiin tai tehdä valituksen tietosuojavaltuutetun toimistolle."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "Euroopan komissio" }, { href: "https://tietosuoja.fi/", label: "Tietosuojavaltuutetun toimisto" }] },
    { title: "10. Evästeet ja muutokset", body: ["Palvelu käyttää välttämättömiä evästeitä ja paikallista tallennusta kirjautumiseen, istuntoon, kielivalintaan ja turvallisuuteen. Päivitämme selostetta, kun palvelu tai käsittely muuttuu."] }
  ]
};

const privacyCopy: Record<Locale, LegalCopy> = {
  fi: fiCopy,
  en: {
    ...fiCopy,
    title: "Privacy Notice",
    updated: "Updated 14 May 2026 · EU GDPR compliant notice",
    terms: "Terms of Use",
    summaryLabel: "Privacy summary",
    summary: [
      { title: "Data is used to run the service", text: "We process data to provide accounts, listings, messages and safer trading." },
      { title: "Retention is limited", text: "Data is kept only as long as needed for the service, law or misuse investigations." },
      { title: "Data is not sold", text: "We do not sell personal data. Providers are used only to operate the service." },
      { title: "GDPR rights belong to you", text: "You may request access, correction, erasure, restriction, portability or object to processing." }
    ],
    sections: [
      { title: "1. Controller", body: ["The controller is Arctic Parts Oy. For privacy matters contact info@arcticparts.fi.", "Business ID and postal address will be added when company details are confirmed for publication."] },
      { title: "2. Data we collect", body: ["We collect only data necessary for the service."], bullets: ["account details such as name, email, phone and location", "company account details such as company name and business ID", "listing photos, prices, part details, descriptions and locations", "messages, reviews, notifications and security logs"] },
      { title: "3. Purposes", body: ["Data is used for account management, publishing listings, buyer-seller communication, customer support, security, preventing misuse and improving the service."] },
      { title: "4. Legal basis", body: ["Processing is based on contract performance, legal obligations, legitimate interests for service security and consent where consent is requested."] },
      { title: "5. EU General Data Protection Regulation (GDPR)", body: ["Maskines processes personal data according to GDPR principles: lawfully, fairly, transparently and only for defined purposes."], bullets: ["data minimisation", "storage limitation", "integrity and confidentiality", "accountability"] },
      { title: "6. Retention", body: ["Account data is kept while the account exists. After deletion, data is removed or anonymised within a reasonable time unless law, disputes or misuse investigations require longer retention."] },
      { title: "7. Recipients and transfers", body: ["We do not sell personal data. Data may be processed by technical providers such as database, login, payment, email or hosting services. Transfers outside the EU/EEA use GDPR safeguards."] },
      { title: "8. Your rights", body: ["You have the right to access, rectify, erase, restrict, object and receive certain data in machine-readable form. Send requests to info@arcticparts.fi."] },
      { title: "9. Complaint and more information", body: ["If you believe your data is processed unlawfully, contact Maskines or lodge a complaint with a supervisory authority."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "European Commission" }, { href: "https://tietosuoja.fi/", label: "Finnish Data Protection Ombudsman" }] },
      { title: "10. Cookies and changes", body: ["The service uses necessary cookies and local storage for login, sessions, language choice and security. We update this notice when the service or processing changes."] }
    ]
  },
  sv: fiCopy,
  no: fiCopy,
  et: fiCopy
};

function stripSectionNumber(title: string) {
  return title.replace(/^\d+\.\s*/, "");
}

export default function PrivacyPage() {
  const { locale } = useLanguage();
  const copy = privacyCopy[locale];

  return (
    <main className="privacy-page privacy-clean-page">
      <article className="privacy-shell">
        <section className="privacy-hero">
          <div className="privacy-hero-copy">
            <h1>{copy.title}</h1>
            <p>{copy.updated}</p>
            <div className="privacy-actions">
              <Link href="/terms" className="privacy-terms-link">{copy.terms}</Link>
            </div>
          </div>
        </section>
        <section className="privacy-summary" aria-label={copy.summaryLabel}>
          {copy.summary.map((item, index) => (
            <div key={item.title} className="privacy-summary-item">
              <strong>
                <span className="legal-number">{index + 1}</span>
                <span>{item.title}</span>
              </strong>
              <span>{item.text}</span>
            </div>
          ))}
        </section>
        <div className="privacy-content">
          {copy.sections.map((section, index) => (
            <section key={section.title} className="privacy-section">
              <h2>
                <span className="legal-number">{index + 1}</span>
                <span>{stripSectionNumber(section.title)}</span>
              </h2>
              {section.body.map((text) => <p key={text}>{text}</p>)}
              {section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}
              {section.links ? (
                <p className="legal-source-links">
                  {section.links.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                  ))}
                </p>
              ) : null}
            </section>
          ))}
        </div>
      </article>
      <style>{`
        .privacy-clean-page .privacy-shell {
          margin: 0 auto;
          max-width: 980px;
          padding: clamp(34px, 5vw, 72px) clamp(22px, 4vw, 44px) 82px;
          width: 100%;
          display: grid;
          gap: 18px;
        }

        .privacy-clean-page .privacy-hero {
          border-bottom: 1px solid rgba(151, 178, 205, 0.18);
          padding-bottom: 30px;
        }

        .privacy-clean-page h1 {
          color: #fff;
          font-size: clamp(48px, 7vw, 82px);
          line-height: 0.95;
          letter-spacing: 0;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .privacy-clean-page .privacy-hero p {
          color: rgba(213, 224, 235, 0.82);
          font-size: 15px;
          line-height: 1.55;
          margin: 14px 0 0;
        }

        .privacy-clean-page .privacy-actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }

        .privacy-clean-page .privacy-terms-link {
          align-items: center;
          background: rgba(15, 33, 53, 0.86);
          border: 1px solid rgba(255, 122, 26, 0.32);
          border-radius: 8px;
          color: #f4f8fc;
          display: inline-flex;
          gap: 8px;
          font-weight: 950;
          min-height: 42px;
          padding: 0 14px;
          text-decoration: none;
          white-space: normal;
        }

        .privacy-clean-page .privacy-summary {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
          width: 100%;
        }

        .privacy-clean-page .privacy-summary-item {
          background: linear-gradient(135deg, rgba(12, 29, 42, 0.96), rgba(5, 18, 31, 0.98)) !important;
          border: 1px solid rgba(92, 132, 166, 0.26);
          border-radius: 8px;
          box-shadow: 0 18px 50px rgba(0, 5, 14, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03);
          display: grid;
          gap: 12px;
          min-width: 0;
          padding: clamp(18px, 3vw, 26px);
        }

        .privacy-clean-page .privacy-summary-item strong {
          overflow-wrap: anywhere;
        }

        .privacy-clean-page .privacy-summary-item span,
        .privacy-clean-page .privacy-section p,
        .privacy-clean-page .privacy-section li {
          overflow-wrap: anywhere;
          white-space: normal;
        }

        .privacy-clean-page .privacy-content {
          display: grid;
          gap: 12px;
        }

        .privacy-clean-page .privacy-section {
          background: linear-gradient(135deg, rgba(12, 29, 42, 0.96), rgba(5, 18, 31, 0.98)) !important;
          border: 1px solid rgba(92, 132, 166, 0.26);
          border-radius: 8px;
          box-shadow: 0 18px 50px rgba(0, 5, 14, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03);
          display: grid;
          gap: 12px;
          min-width: 0;
          padding: clamp(18px, 3vw, 26px);
        }

        .privacy-clean-page .privacy-section h2 {
          overflow-wrap: anywhere;
        }

        .privacy-clean-page .privacy-section ul {
          display: grid;
          gap: 8px;
          margin: 2px 0 0;
          padding-left: 22px;
        }

        .privacy-clean-page .legal-source-links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px !important;
        }

        .privacy-clean-page .legal-source-links a {
          border: 1px solid rgba(255, 122, 26, 0.34);
          border-radius: 999px;
          color: #ffb568;
          padding: 8px 12px;
          text-decoration: none;
        }
        @media (max-width: 640px) {
          .privacy-clean-page .privacy-shell {
            padding-left: 16px;
            padding-right: 16px;
          }

          .privacy-clean-page .privacy-summary-item strong,
          .privacy-clean-page .privacy-section h2 {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
