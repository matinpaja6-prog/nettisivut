"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  COOKIE_CONSENT_EVENT,
  readCookieConsent,
  saveCookieConsent,
  type CookieConsentChoice
} from "@/lib/cookie-consent";
import { useLanguage, type Locale } from "@/lib/i18n";

type CookiePolicyCopy = {
  title: string;
  updated: string;
  privacy: string;
  summaryLabel: string;
  currentChoice: string;
  notChosen: string;
  all: string;
  essential: string;
  custom: string;
  summary: Array<{ title: string; text: string }>;
  sections: Array<{ title: string; body: string[]; bullets?: string[] }>;
};

const fiCopy: CookiePolicyCopy = {
  title: "Evästeseloste",
  updated: "Päivitetty 8.8.2026 · Eväste- ja paikallistallennuskäytäntö",
  privacy: "Tietosuojaseloste",
  summaryLabel: "Evästekäytännön tiivistelmä",
  currentChoice: "Nykyinen valinta",
  notChosen: "Valintaa ei ole vielä tehty",
  all: "Kaikki evästeet",
  essential: "Vain välttämättömät",
  custom: "Mukautettu valinta",
  summary: [
    { title: "Välttämättömät tiedot", text: "Teknistä tallennusta käytetään kirjautumiseen, turvallisuuteen, kielivalintaan ja palvelun perustoimintoihin." },
    { title: "Analytiikka ja personointi ovat valinnaisia", text: "Voit sallia kävijätilastot ja yksilölliset ilmoitussuositukset erikseen." },
    { title: "Valinta muistetaan vuoden", text: "Tallennamme tekemäsi valinnan, jotta kysymystä ei näytetä jokaisella käynnillä." },
    { title: "Valintaa voi muuttaa", text: "Voit vaihtaa asetuksen tällä sivulla milloin tahansa." }
  ],
  sections: [
    { title: "1. Mitä evästeet ja paikallinen tallennus ovat?", body: ["Evästeet ovat selaimeen tallennettavia pieniä tietoja. Maskines käyttää lisäksi selaimen localStorage- ja sessionStorage-tallennusta samoihin teknisiin ja käyttökokemusta tukeviin tarkoituksiin."] },
    { title: "2. Välttämättömät tallenteet", body: ["Nämä ovat tarpeen palvelun pyytämiesi toimintojen, turvallisuuden ja istunnon toteuttamiseksi."], bullets: ["kirjautumis- ja käyttäjäistunto", "evästevalinnan tallentaminen", "kieli- ja ulkoasuvalinnat", "tietoturva ja väärinkäytösten estäminen", "ostosten, viestien ja ilmoitusten tekninen toiminta"] },
    { title: "3. Valinnainen analytiikka ja personointi", body: ["Analytiikkaluvalla Maskines tallentaa sivukäynnin palvelun oman kävijätilaston muodostamiseksi. Personointiluvalla palvelu voi käyttää katseluhistoriaa yksilöllisten ilmoitussuositusten muodostamiseen. Voit sallia kategoriat erikseen tai käyttää vain välttämättömiä evästeitä."] },
    { title: "4. Mitä valinnasta tallennetaan?", body: ["Tallennamme valitut kategoriat, valinta-ajankohdan ja käytäntöversion. Suostumusevästeen nimi on maskines_cookie_consent_v2 ja vastaava tarkempi valinta tallennetaan selaimen paikalliseen tallennukseen."] },
    { title: "5. Säilytys ja vanheneminen", body: ["Evästevalinta on voimassa enintään 12 kuukautta. Istuntokohtaiset tiedot poistuvat tavallisesti selaimen istunnon päättyessä. Kirjautumistietojen säilytys määräytyy käyttäjäistunnon ja palveluntarjoajan turvallisuusasetusten mukaan."] },
    { title: "6. Palveluntarjoajat", body: ["Teknisiä tallenteita voivat käsitellä Maskinesin puolesta palvelun toteuttamiseen osallistuvat infrastruktuuri-, tietokanta-, kirjautumis-, kartta- ja turvallisuuspalvelujen tarjoajat. Henkilötietojen käsittelystä kerrotaan tarkemmin tietosuojaselosteessa."] },
    { title: "7. Valinnan muuttaminen", body: ["Voit vaihtaa valintasi tämän sivun painikkeilla. Voit myös poistaa evästeet selaimen asetuksista, jolloin valinta kysytään uudelleen seuraavalla käynnillä."] },
    { title: "8. Yhteystiedot", body: ["Rekisterinpitäjä on Arctic Parts Oy. Eväste- ja tietosuoja-asioissa voit ottaa yhteyttä osoitteeseen info@maskines.com."] }
  ]
};

const policyCopy: Record<Locale, CookiePolicyCopy> = {
  fi: fiCopy,
  en: {
    ...fiCopy,
    title: "Cookie Notice",
    updated: "Updated 8 August 2026 · Cookie and local storage policy",
    privacy: "Privacy Notice",
    summaryLabel: "Cookie policy summary",
    currentChoice: "Current choice",
    notChosen: "No choice has been made",
    all: "All cookies",
    essential: "Essential only",
    custom: "Custom choice"
  },
  sv: {
    ...fiCopy,
    title: "Cookiepolicy",
    privacy: "Integritetspolicy",
    currentChoice: "Nuvarande val",
    notChosen: "Inget val har gjorts",
    all: "Alla cookies",
    essential: "Endast nödvändiga",
    custom: "Anpassat val"
  },
  no: {
    ...fiCopy,
    title: "Informasjonskapsler",
    privacy: "Personvernerklæring",
    currentChoice: "Gjeldende valg",
    notChosen: "Ingen valg er gjort",
    all: "Alle informasjonskapsler",
    essential: "Kun nødvendige",
    custom: "Tilpasset valg"
  }
};

function stripSectionNumber(title: string) {
  return title.replace(/^\d+\.\s*/, "");
}

export default function CookiesPage() {
  const { locale } = useLanguage();
  const copy = policyCopy[locale];
  const [choice, setChoice] = useState<CookieConsentChoice | null>(null);

  useEffect(() => {
    setChoice(readCookieConsent());
    const handleChange = () => {
      setChoice(readCookieConsent());
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, handleChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleChange);
  }, []);

  const updateChoice = (nextChoice: CookieConsentChoice) => {
    saveCookieConsent(nextChoice);
    setChoice(nextChoice);
  };

  return (
    <main className="privacy-page privacy-clean-page cookie-policy-page">
      <article className="privacy-shell">
        <section className="privacy-hero">
          <div className="privacy-hero-copy">
            <h1>{copy.title}</h1>
            <p>{copy.updated}</p>
            <div className="privacy-actions">
              <Link href="/tietosuoja" className="privacy-terms-link">{copy.privacy}</Link>
            </div>
          </div>
        </section>

        <section className="cookie-policy-choice" aria-label={copy.currentChoice}>
          <span><strong>{copy.currentChoice}:</strong> {choice === "all" ? copy.all : choice === "essential" ? copy.essential : choice === "custom" ? copy.custom : copy.notChosen}</span>
          <div className="cookie-policy-choice-actions">
            <button type="button" className="cookie-consent-essential" onClick={() => updateChoice("essential")}>{copy.essential}</button>
            <button type="button" className="cookie-consent-accept" onClick={() => updateChoice("all")}>{copy.all}</button>
          </div>
        </section>

        <section className="privacy-summary" aria-label={copy.summaryLabel}>
          {copy.summary.map((item, index) => (
            <div key={item.title} className="privacy-summary-item">
              <strong><span className="legal-number">{index + 1}</span><span>{item.title}</span></strong>
              <span>{item.text}</span>
            </div>
          ))}
        </section>

        <div className="privacy-content">
          {copy.sections.map((section) => (
            <details key={section.title} className="privacy-section legal-accordion-item">
              <summary>
                <span>{stripSectionNumber(section.title)}</span>
                <span className="legal-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="legal-accordion-body">
                {section.body.map((text) => <p key={text}>{text}</p>)}
                {section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}
              </div>
            </details>
          ))}
        </div>
        <p className="legal-updated-footer">{copy.updated}</p>
      </article>
    </main>
  );
}
