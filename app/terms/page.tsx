"use client";

import Link from "next/link";
import { BadgeCheck, FileText, Handshake } from "lucide-react";
import { useLanguage, type Locale } from "@/lib/i18n";

const termsCopy: Record<Locale, {
  back: string; eyebrow: string; title: string; updated: string; privacy: string; summaryLabel: string;
  summary: Array<{ title: string; text: string }>;
  sections: Array<{ title: string; body: string[]; bullets?: string[] }>;
}> = {
  fi: {
    back: "Takaisin", eyebrow: "Palvelun ehdot", title: "Käyttöehdot", updated: "Päivitetty 14.5.2026", privacy: "Tietosuojaseloste", summaryLabel: "Käyttöehtojen tiivistelmä",
    summary: [
      { title: "Myyjä vastaa ilmoituksesta", text: "Ilmoituksen tietojen, hinnan, kuvien ja kuvauksen pitää olla oikein ja ajan tasalla." },
      { title: "Kauppa on käyttäjien välinen", text: "Arctic Parts toimii alustana. Ostaja ja myyjä sopivat maksusta, toimituksesta ja tuotteen kunnosta." },
      { title: "Palvelua käytetään reilusti", text: "Huijaukset, häirintä, laiton sisältö ja toisten tietojen väärinkäyttö voidaan poistaa." }
    ],
    sections: [
      { title: "1. Palvelun kuvaus", body: ["Arctic Parts on varaosien kauppapaikka, jossa käyttäjät voivat ostaa ja myydä moottorikelkkojen, mönkijöiden, motocross-pyörien ja mopojen varaosia, tarvikkeita sekä niihin liittyviä tuotteita."] },
      { title: "2. Käyttäjätili", body: ["Ilmoittaminen, viestit ja osa muista toiminnoista edellyttävät käyttäjätiliä. Käyttäjä vastaa tietojensa oikeellisuudesta ja kirjautumistietojen huolellisesta säilyttämisestä.", "Tili on henkilökohtainen tai yrityskohtainen. Tiliä ei saa luovuttaa toiselle ilman Arctic Partsin lupaa."] },
      { title: "3. Ilmoitukset", body: ["Myyjä vastaa ilmoituksen sisällöstä. Tuotteen kunto, sopivuus, varaosan tiedot, hinta, sijainti ja kuvat on ilmoitettava totuudenmukaisesti.", "Kiellettyä sisältöä ovat esimerkiksi:"], bullets: ["varastettu, laiton tai vaaralliseksi tiedetty tuote", "harhaanjohtava hinta, kuva tai tuotteen kuntoa koskeva tieto", "toisen henkilön, yrityksen, kuvan tai tavaramerkin luvaton käyttö", "huijaustarkoituksessa palvelusta pois ohjaavat ilmoitukset"] },
      { title: "4. Kaupankäynti", body: ["Arctic Parts ei ole kaupan osapuoli. Kauppa syntyy ostajan ja myyjän välillä. Osapuolet sopivat maksusta, toimituksesta, noudosta, palautuksista ja reklamaatioista.", "Suosittelemme tarkistamaan tuotteen tiedot, sopivuuden ja myyjän profiilin ennen kauppaa."] },
      { title: "5. Maksulliset ominaisuudet", body: ["Lisäominaisuudet, kuten ilmoituspaikat, korostukset ja näkyvyyslisät, näytetään käyttäjälle ennen maksun vahvistamista. Digitaalisen palvelun maksua ei palauteta, jos ominaisuus on otettu käyttöön, ellei pakottava laki muuta edellytä."] },
      { title: "6. Turvallisuus ja väärinkäytökset", body: ["Palvelua ei saa käyttää huijaamiseen, häirintään, roskapostiin, automatisoituun käyttöön ilman lupaa, haittaohjelmien levittämiseen tai toisen henkilön tietojen väärinkäyttöön.", "Arctic Parts voi poistaa sisältöä, rajoittaa toimintoja tai sulkea tilin, jos käyttö rikkoo ehtoja tai aiheuttaa riskin muille."] },
      { title: "7. Vastuu ja saatavuus", body: ["Pyrimme pitämään palvelun toimivana ja turvallisena, mutta emme takaa keskeytyksetöntä saatavuutta. Emme vastaa käyttäjien välisen kaupan toteutumisesta, tuotteen virheistä, toimituksen viivästymisestä tai välillisistä vahingoista."] },
      { title: "8. Tietosuoja", body: ["Henkilötietoja käsitellään tietosuojaselosteen mukaisesti. Emme myy henkilötietoja. Käyttäjä vastaa siitä, ettei julkaise ilmoituksissa tai viesteissä tarpeettomia henkilötietoja."] },
      { title: "9. Ehtojen muuttaminen", body: ["Voimme päivittää käyttöehtoja, kun palvelu muuttuu tai lainsäädäntö edellyttää muutoksia. Olennaisista muutoksista kerrotaan palvelussa tai sähköpostitse ennen voimaantuloa."] },
      { title: "10. Sovellettava laki ja yhteys", body: ["Näihin ehtoihin sovelletaan Suomen lakia. Kysymykset: tuki@arcticparts.fi"] }
    ]
  },
  en: {
    back: "Back", eyebrow: "Service terms", title: "Terms of Use", updated: "Updated 14 May 2026", privacy: "Privacy Notice", summaryLabel: "Terms summary",
    summary: [
      { title: "Seller is responsible", text: "Listing details, price, photos and description must be accurate and up to date." },
      { title: "Trade is between users", text: "Arctic Parts provides the platform. Buyer and seller agree payment, delivery and condition." },
      { title: "Use the service fairly", text: "Fraud, harassment, illegal content and misuse of data may be removed." }
    ],
    sections: [
      { title: "1. Service description", body: ["Arctic Parts is a marketplace for buying and selling spare parts, accessories and related products for snowmobiles, ATVs, motocross bikes and mopeds."] },
      { title: "2. User account", body: ["Posting listings, messaging and some features require an account. You are responsible for accurate account details and keeping login credentials secure.", "Accounts are personal or company-specific and may not be transferred without permission."] },
      { title: "3. Listings", body: ["The seller is responsible for listing content. Condition, compatibility, part details, price, location and photos must be truthful.", "Prohibited content includes:"], bullets: ["stolen, illegal or known dangerous products", "misleading prices, photos or condition details", "unauthorized use of another person, company, photo or trademark", "listings intended to redirect users for fraud"] },
      { title: "4. Trading", body: ["Arctic Parts is not a party to the transaction. Buyer and seller agree payment, delivery, pickup, returns and complaints.", "Check product details, compatibility and seller profile before trading."] },
      { title: "5. Paid features", body: ["Paid features such as listing slots, highlights and visibility boosts are shown before payment confirmation. Digital service payments are not refunded after activation unless mandatory law requires otherwise."] },
      { title: "6. Safety and misuse", body: ["The service may not be used for fraud, harassment, spam, unauthorized automation, malware or misuse of another person’s data.", "Arctic Parts may remove content, restrict features or close accounts that break these terms or create risk."] },
      { title: "7. Liability and availability", body: ["We aim to keep the service functional and secure, but do not guarantee uninterrupted availability. We are not responsible for user-to-user transactions, product defects, delivery delays or indirect damages."] },
      { title: "8. Privacy", body: ["Personal data is processed according to the Privacy Notice. We do not sell personal data. Users should avoid publishing unnecessary personal data in listings or messages."] },
      { title: "9. Changes", body: ["We may update these terms when the service or law changes. Material changes are announced in the service or by email before they take effect."] },
      { title: "10. Governing law and contact", body: ["Finnish law applies. Questions: tuki@arcticparts.fi"] }
    ]
  },
  sv: {
    back: "Tillbaka", eyebrow: "Tjänstevillkor", title: "Användarvillkor", updated: "Uppdaterad 14.5.2026", privacy: "Integritetspolicy", summaryLabel: "Sammanfattning",
    summary: [{ title: "Säljaren ansvarar", text: "Uppgifter, pris, bilder och beskrivning ska vara korrekta." }, { title: "Affären sker mellan användare", text: "Arctic Parts är plattformen. Köpare och säljare avtalar om betalning och leverans." }, { title: "Använd tjänsten rättvist", text: "Bedrägeri, trakasserier och olagligt innehåll kan tas bort." }],
    sections: [
      { title: "1. Tjänsten", body: ["Arctic Parts är en marknadsplats för reservdelar och tillbehör till snöskotrar, fyrhjulingar, motocross och mopeder."] },
      { title: "2. Konto", body: ["Annonser, meddelanden och vissa funktioner kräver konto. Du ansvarar för korrekta uppgifter och säker inloggning.", "Kontot är personligt eller företagsbundet och får inte överlåtas utan tillstånd."] },
      { title: "3. Annonser", body: ["Säljaren ansvarar för annonsens innehåll. Skick, passform, pris, plats och bilder ska vara sanningsenliga.", "Förbjudet innehåll:"], bullets: ["stulna eller olagliga produkter", "vilseledande pris eller skick", "obehörig användning av annans material", "bedrägliga omdirigeringar"] },
      { title: "4. Handel", body: ["Arctic Parts är inte part i affären. Köpare och säljare avtalar själva om betalning, leverans och reklamationer."] },
      { title: "5. Betalfunktioner", body: ["Betalda funktioner visas innan betalning. Digitala tjänster återbetalas inte efter aktivering om inte tvingande lag kräver det."] },
      { title: "6. Säkerhet", body: ["Tjänsten får inte användas för bedrägeri, trakasserier, spam, skadliga länkar eller missbruk av personuppgifter."] },
      { title: "7. Ansvar", body: ["Vi strävar efter en fungerande tjänst men garanterar inte oavbruten tillgång och ansvarar inte för användarnas affärer."] },
      { title: "8. Integritet", body: ["Personuppgifter behandlas enligt integritetspolicyn. Vi säljer inte personuppgifter."] },
      { title: "9. Ändringar", body: ["Villkoren kan uppdateras när tjänsten eller lagen ändras. Väsentliga ändringar meddelas i tjänsten eller via e-post."] },
      { title: "10. Lag och kontakt", body: ["Finsk lag gäller. Frågor: tuki@arcticparts.fi"] }
    ]
  },
  no: {
    back: "Tilbake", eyebrow: "Vilkår", title: "Brukervilkår", updated: "Oppdatert 14.5.2026", privacy: "Personvernerklæring", summaryLabel: "Sammendrag",
    summary: [{ title: "Selger har ansvar", text: "Opplysninger, pris, bilder og beskrivelse må være korrekte." }, { title: "Handel skjer mellom brukere", text: "Arctic Parts er plattformen. Kjøper og selger avtaler betaling og levering." }, { title: "Bruk tjenesten rettferdig", text: "Svindel, trakassering og ulovlig innhold kan fjernes." }],
    sections: [
      { title: "1. Tjenesten", body: ["Arctic Parts er en markedsplass for reservedeler og tilbehør til snøscootere, ATV-er, motocross og mopeder."] },
      { title: "2. Konto", body: ["Annonser, meldinger og enkelte funksjoner krever konto. Du er ansvarlig for korrekte opplysninger og sikker innlogging."] },
      { title: "3. Annonser", body: ["Selger er ansvarlig for annonsen. Tilstand, passform, pris, sted og bilder skal være riktige."], bullets: ["stjålne eller ulovlige varer", "villedende pris eller tilstand", "uautorisert bruk av andres materiale", "svindelrettede lenker"] },
      { title: "4. Handel", body: ["Arctic Parts er ikke part i handelen. Kjøper og selger avtaler betaling, levering og reklamasjoner."] },
      { title: "5. Betalte funksjoner", body: ["Betalte funksjoner vises før betaling og refunderes ikke etter aktivering med mindre loven krever det."] },
      { title: "6. Sikkerhet", body: ["Tjenesten må ikke brukes til svindel, trakassering, spam, skadevare eller misbruk av personopplysninger."] },
      { title: "7. Ansvar", body: ["Vi prøver å holde tjenesten tilgjengelig, men garanterer ikke avbruddsfri drift og er ikke ansvarlige for handler mellom brukere."] },
      { title: "8. Personvern", body: ["Personopplysninger behandles etter personvernerklæringen. Vi selger ikke personopplysninger."] },
      { title: "9. Endringer", body: ["Vilkårene kan oppdateres når tjenesten eller loven endres. Vesentlige endringer varsles."] },
      { title: "10. Lov og kontakt", body: ["Finsk lov gjelder. Spørsmål: tuki@arcticparts.fi"] }
    ]
  },
  et: {
    back: "Tagasi", eyebrow: "Teenuse tingimused", title: "Kasutustingimused", updated: "Uuendatud 14.5.2026", privacy: "Privaatsusteade", summaryLabel: "Kokkuvõte",
    summary: [{ title: "Müüja vastutab", text: "Kuulutuse andmed, hind, pildid ja kirjeldus peavad olema õiged." }, { title: "Tehing on kasutajate vahel", text: "Arctic Parts on platvorm. Ostja ja müüja lepivad makse ja tarne kokku." }, { title: "Kasuta teenust ausalt", text: "Pettus, ahistamine ja ebaseaduslik sisu võidakse eemaldada." }],
    sections: [
      { title: "1. Teenus", body: ["Arctic Parts on varuosade ja tarvikute turuplats mootorsaanidele, ATV-dele, krossiratastele ja mopeedidele."] },
      { title: "2. Konto", body: ["Kuulutused, sõnumid ja osa funktsioone nõuavad kontot. Vastutad õigete andmete ja turvalise sisselogimise eest."] },
      { title: "3. Kuulutused", body: ["Müüja vastutab kuulutuse sisu eest. Seisukord, sobivus, hind, asukoht ja pildid peavad olema tõesed."], bullets: ["varastatud või ebaseaduslik kaup", "eksitav hind või seisukord", "teise isiku materjali loata kasutamine", "pettuslikud ümbersuunamised"] },
      { title: "4. Kauplemine", body: ["Arctic Parts ei ole tehingu osapool. Ostja ja müüja lepivad ise kokku makse, tarne ja pretensioonid."] },
      { title: "5. Tasulised funktsioonid", body: ["Tasulised funktsioonid kuvatakse enne makset ja neid ei tagastata pärast aktiveerimist, kui seadus ei nõua teisiti."] },
      { title: "6. Turvalisus", body: ["Teenust ei tohi kasutada pettuseks, ahistamiseks, spämmiks, pahavaraks ega isikuandmete väärkasutuseks."] },
      { title: "7. Vastutus", body: ["Püüame hoida teenuse töökorras, kuid ei taga katkestusteta kättesaadavust ega vastuta kasutajate tehingute eest."] },
      { title: "8. Privaatsus", body: ["Isikuandmeid töödeldakse privaatsusteate järgi. Me ei müü isikuandmeid."] },
      { title: "9. Muudatused", body: ["Tingimusi võidakse uuendada, kui teenus või seadus muutub. Olulistest muudatustest teatatakse."] },
      { title: "10. Õigus ja kontakt", body: ["Kohaldub Soome õigus. Küsimused: tuki@arcticparts.fi"] }
    ]
  }
};

export default function TermsPage() {
  const { locale } = useLanguage();
  const copy = termsCopy[locale];
  const icons = [FileText, Handshake, BadgeCheck];

  return (
    <main className="terms-page terms-clean-page">
      <article className="terms-shell">
        <section className="terms-hero">
          <div className="terms-hero-copy">
            <h1>{copy.title}</h1>
            <p>{copy.updated}</p>
            <div className="terms-actions">
              <Link href="/privacy" className="terms-privacy-link">{copy.privacy}</Link>
            </div>
          </div>
        </section>
        <section className="terms-summary" aria-label={copy.summaryLabel}>
          {copy.summary.map((item, i) => {
            const Icon = icons[i];
            return (
              <div key={item.title} className="terms-summary-item">
                <Icon size={20} />
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
            );
          })}
        </section>
        <div className="terms-content">
          {copy.sections.map((section) => (
            <section key={section.title} className="terms-section">
              <h2>{section.title}</h2>
              {section.body.map((text) => <p key={text}>{text}</p>)}
              {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
        </div>
      </article>

      <style>{`
        .terms-clean-page {
          background:
            radial-gradient(760px 360px at 12% 0%, rgba(255, 122, 26, 0.12), transparent 66%),
            linear-gradient(180deg, #030914 0%, #06101d 46%, #020712 100%) !important;
          color: #f4f8fc;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .terms-clean-page .terms-shell {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          display: grid;
          gap: 34px;
          margin: 0 auto;
          max-width: 1120px;
          padding: clamp(34px, 5vw, 72px) clamp(22px, 4vw, 44px) 82px;
          width: 100%;
        }

        .terms-clean-page .terms-hero {
          border-bottom: 1px solid rgba(151, 178, 205, 0.18);
          padding-bottom: 30px;
        }

        .terms-clean-page .terms-hero-copy {
          min-width: 0;
        }

        .terms-clean-page .terms-eyebrow {
          background: rgba(255, 122, 26, 0.14) !important;
          border: 1px solid rgba(255, 122, 26, 0.34) !important;
          border-radius: 999px;
          color: #ffb45f !important;
          display: inline-flex;
          font-size: 12px;
          font-weight: 950;
          margin-bottom: 14px;
          padding: 6px 10px;
          width: fit-content;
        }

        .terms-clean-page h1 {
          color: #fff !important;
          font-size: clamp(48px, 7vw, 82px);
          letter-spacing: 0;
          line-height: 0.95;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .terms-clean-page .terms-hero p {
          color: rgba(215, 226, 238, 0.72) !important;
          font-size: 14px;
          font-weight: 850;
          margin: 14px 0 0;
        }

        .terms-clean-page .terms-actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }

        .terms-clean-page .terms-privacy-link,
        .terms-clean-page .terms-back {
          align-items: center;
          background: rgba(15, 33, 53, 0.86) !important;
          border: 1px solid rgba(255, 122, 26, 0.32) !important;
          border-radius: 8px !important;
          color: #f4f8fc !important;
          display: inline-flex;
          gap: 8px;
          box-shadow: none !important;
          font-weight: 950;
          min-height: 42px;
          padding: 0 14px;
          text-decoration: none;
        }

        .terms-clean-page .terms-back {
          border-color: rgba(151, 178, 205, 0.2) !important;
        }

        .terms-clean-page .terms-summary {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          display: grid;
          gap: 22px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 0 !important;
          width: 100%;
        }

        .terms-clean-page .terms-summary-item {
          background: linear-gradient(135deg, rgba(13, 30, 48, 0.74), rgba(8, 18, 31, 0.42)) !important;
          border: 1px solid rgba(151, 178, 205, 0.14) !important;
          border-radius: 12px;
          box-shadow: none !important;
          display: grid;
          gap: 8px;
          min-width: 0;
          padding: 18px;
          overflow: visible;
        }

        .terms-clean-page .terms-summary-item svg {
          color: #ff9d2e;
          flex: 0 0 auto;
        }

        .terms-clean-page .terms-summary-item strong {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.2;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .terms-clean-page .terms-summary-item span {
          color: rgba(215, 226, 238, 0.72);
          font-size: 13px;
          line-height: 1.55;
          min-width: 0;
          overflow-wrap: anywhere;
          white-space: normal;
        }

        .terms-clean-page .terms-content {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          display: grid;
          gap: 0;
        }

        .terms-clean-page .terms-section {
          background: transparent !important;
          border: 0 !important;
          border-top: 1px solid rgba(151, 178, 205, 0.16) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: #f4f8fc !important;
          display: grid;
          gap: 12px;
          min-width: 0;
          padding: 26px 0 !important;
        }

        .terms-clean-page .terms-section h2 {
          color: #fff !important;
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 950;
          letter-spacing: 0;
          line-height: 1.1;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .terms-clean-page .terms-section p,
        .terms-clean-page .terms-section li {
          color: rgba(215, 226, 238, 0.78) !important;
          font-size: 15px;
          line-height: 1.72;
          max-width: 78ch;
          margin: 0;
          overflow-wrap: anywhere;
          white-space: normal;
        }

        .terms-clean-page .terms-section ul {
          display: grid;
          gap: 8px;
          margin: 2px 0 0;
          padding-left: 22px;
        }

        .terms-clean-page .terms-section li::marker {
          color: #ff9d2e;
        }

        @media (max-width: 900px) {
          .terms-clean-page .terms-summary {
            grid-template-columns: 1fr;
          }

          .terms-clean-page .terms-summary-item {
            padding: 16px;
          }
        }
      `}</style>
    </main>
  );
}
