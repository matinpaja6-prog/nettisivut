"use client";

import Link from "next/link";
import { useLanguage, type Locale } from "@/lib/i18n";

const termsCopy: Record<Locale, {
  back: string; eyebrow: string; title: string; updated: string; privacy: string; summaryLabel: string;
  summary: Array<{ title: string; text: string }>;
  sections: Array<{ title: string; body: string[]; bullets?: string[] }>;
}> = {
  fi: {
    back: "Takaisin", eyebrow: "Palvelun ehdot", title: "Käyttöehdot", updated: "Päivitetty 29.8.2026", privacy: "Tietosuojaseloste", summaryLabel: "Käyttöehtojen tiivistelmä",
    summary: [
      { title: "Myyjä vastaa ilmoituksesta", text: "Ilmoituksen tietojen, hinnan, kuvien ja kuvauksen pitää olla oikein ja ajan tasalla." },
      { title: "Kauppa on käyttäjien välinen", text: "Maskines toimii alustana. Ostaja ja myyjä sopivat maksusta, toimituksesta ja tuotteen kunnosta." },
      { title: "Palvelua käytetään reilusti", text: "Huijaukset, häirintä, laiton sisältö ja toisten tietojen väärinkäyttö voidaan poistaa." }
    ],
    sections: [
      { title: "1. Palvelun kuvaus", body: ["Maskines on varaosien kauppapaikka, jossa käyttäjät voivat ostaa ja myydä moottorikelkkojen, mönkijöiden, motocross-pyörien ja mopojen varaosia, tarvikkeita sekä niihin liittyviä tuotteita."] },
      { title: "2. Käyttäjätili", body: ["Ilmoittaminen, viestit ja osa muista toiminnoista edellyttävät käyttäjätiliä. Käyttäjä vastaa tietojensa oikeellisuudesta ja kirjautumistietojen huolellisesta säilyttämisestä.", "Tili on henkilökohtainen tai yrityskohtainen. Tiliä ei saa luovuttaa toiselle ilman Maskinesin lupaa."] },
      { title: "3. Ilmoitukset", body: ["Myyjä vastaa ilmoituksen sisällöstä. Tuotteen kunto, sopivuus, varaosan tiedot, hinta, sijainti ja kuvat on ilmoitettava totuudenmukaisesti.", "Kiellettyä sisältöä ovat esimerkiksi:"], bullets: ["varastettu, laiton tai vaaralliseksi tiedetty tuote", "harhaanjohtava hinta, kuva tai tuotteen kuntoa koskeva tieto", "toisen henkilön, yrityksen, kuvan tai tavaramerkin luvaton käyttö", "huijaustarkoituksessa palvelusta pois ohjaavat ilmoitukset"] },
      { title: "4. Kaupankäynti ja myyjän vastuu", body: ["Maskines tarjoaa markkinapaikan ja voi välittää maksun teknisesti, mutta Maskines ei ole tuotteen myyjä tai ostajan ja myyjän välisen kaupan osapuoli. Kauppasopimus syntyy aina ostajan ja ilmoituksessa nimetyn myyjän välille.", "Myyjä vastaa tuotteen tietojen oikeellisuudesta, kunnosta, turvallisuudesta ja lainmukaisuudesta sekä maksun jälkeen tapahtuvasta toimituksesta tai luovutuksesta. Myyjä vastaa myös palautuksista, reklamaatioista, hinnanalennuksista, kaupan purusta, hyvityksistä ja muista myyjän lakisääteisistä tai sovituista velvoitteista.", "Jos tuote on virheellinen tai myyjä ei hyväksy palautusta, ostajan tulee esittää vaatimus suoraan myyjälle. Maskines voi tarjota teknistä tukea tai välittää tietoja lain sallimissa rajoissa, mutta se ei ota myyjän velvoitteita vastatakseen.", "Yritysmyyjän ja kuluttajan väliseen kauppaan sovelletaan pakottavaa kuluttajansuojalainsäädäntöä. Yksityishenkilöiden väliseen kauppaan ei yleensä kuulu kuluttajansuojalain mukainen peruuttamisoikeus. Ostajan kannattaa tarkistaa myyjän asema, tuotteen tiedot, sopivuus ja palautusehdot ennen maksamista."] },
      { title: "5. Maksulliset ominaisuudet", body: ["Lisäominaisuudet, kuten ilmoituspaikat, korostukset ja näkyvyyslisät, näytetään käyttäjälle ennen maksun vahvistamista. Digitaalisen palvelun maksua ei palauteta, jos ominaisuus on otettu käyttöön, ellei pakottava laki muuta edellytä."] },
      { title: "6. Turvallisuus ja väärinkäytökset", body: ["Palvelua ei saa käyttää huijaamiseen, häirintään, roskapostiin, automatisoituun käyttöön ilman lupaa, haittaohjelmien levittämiseen tai toisen henkilön tietojen väärinkäyttöön.", "Maskines voi poistaa sisältöä, rajoittaa toimintoja tai sulkea tilin, jos käyttö rikkoo ehtoja tai aiheuttaa riskin muille."] },
      { title: "7. Maskinesin vastuu ja palvelun saatavuus", body: ["Maskines vastaa omasta alustapalvelustaan ja sen toiminnasta sovellettavan pakottavan lain mukaisesti. Pyrimme pitämään palvelun toimivana ja turvallisena, mutta emme takaa keskeytyksetöntä tai virheetöntä saatavuutta.", "Maskines ei vastaa myyjän tuotteen laadusta, kunnosta, sopivuudesta tai virheestä eikä myyjän toimitus-, palautus-, reklamaatio- tai hyvitysvelvollisuuden täyttämisestä. Maskines ei myöskään takaa käyttäjän henkilöllisyyttä, ilmoituksen tietoja tai kaupan toteutumista.", "Mikään näissä ehdoissa ei rajoita vastuuta tai käyttäjän oikeuksia siltä osin kuin niitä ei pakottavan lain mukaan voida rajoittaa."] },
      { title: "8. Tietosuoja", body: ["Henkilötietoja käsitellään tietosuojaselosteen mukaisesti. Emme myy henkilötietoja. Käyttäjä vastaa siitä, ettei julkaise ilmoituksissa tai viesteissä tarpeettomia henkilötietoja."] },
      { title: "9. Ehtojen muuttaminen", body: ["Voimme päivittää käyttöehtoja, kun palvelu muuttuu tai lainsäädäntö edellyttää muutoksia. Olennaisista muutoksista kerrotaan palvelussa tai sähköpostitse ennen voimaantuloa."] },
      { title: "10. Sovellettava laki ja yhteys", body: ["Näihin ehtoihin sovelletaan Suomen lakia. Kysymykset: info@maskines.com"] }
    ]
  },
  en: {
    back: "Back", eyebrow: "Service terms", title: "Terms of Use", updated: "Updated 29 August 2026", privacy: "Privacy Notice", summaryLabel: "Terms summary",
    summary: [
      { title: "Seller is responsible", text: "Listing details, price, photos and description must be accurate and up to date." },
      { title: "Trade is between users", text: "Maskines provides the platform. Buyer and seller agree payment, delivery and condition." },
      { title: "Use the service fairly", text: "Fraud, harassment, illegal content and misuse of data may be removed." }
    ],
    sections: [
      { title: "1. Service description", body: ["Maskines is a marketplace for buying and selling spare parts, accessories and related products for snowmobiles, ATVs, motocross bikes and mopeds."] },
      { title: "2. User account", body: ["Posting listings, messaging and some features require an account. You are responsible for accurate account details and keeping login credentials secure.", "Accounts are personal or company-specific and may not be transferred without permission."] },
      { title: "3. Listings", body: ["The seller is responsible for listing content. Condition, compatibility, part details, price, location and photos must be truthful.", "Prohibited content includes:"], bullets: ["stolen, illegal or known dangerous products", "misleading prices, photos or condition details", "unauthorized use of another person, company, photo or trademark", "listings intended to redirect users for fraud"] },
      { title: "4. Trading and seller responsibility", body: ["Maskines provides the marketplace and may technically facilitate payment, but is not the product seller or a party to the contract between buyer and seller. The sales contract is between the buyer and the seller identified in the listing.", "The seller is responsible for the accuracy, condition, safety and legality of the product and for delivery or handover after payment. The seller is also responsible for returns, complaints, price reductions, cancellation, refunds and other statutory or agreed seller obligations.", "Claims concerning a defective product or a refused return must be addressed directly to the seller. Maskines may provide technical support but does not assume the seller's obligations.", "Mandatory consumer law applies to sales between a business seller and a consumer. Sales between private individuals generally do not carry a statutory consumer cancellation right. Check the seller's status, product details and return terms before payment."] },
      { title: "5. Paid features", body: ["Paid features such as listing slots, highlights and visibility boosts are shown before payment confirmation. Digital service payments are not refunded after activation unless mandatory law requires otherwise."] },
      { title: "6. Safety and misuse", body: ["The service may not be used for fraud, harassment, spam, unauthorized automation, malware or misuse of another person’s data.", "Maskines may remove content, restrict features or close accounts that break these terms or create risk."] },
      { title: "7. Maskines liability and availability", body: ["Maskines is responsible for its own platform service and operations as required by mandatory applicable law. We aim to keep the service functional and secure but do not guarantee uninterrupted or error-free availability.", "Maskines is not responsible for the seller's product quality, condition, compatibility or defects, or for the seller's performance of delivery, return, complaint or refund obligations. Maskines does not guarantee a user's identity, listing information or completion of a sale.", "Nothing in these terms limits liability or user rights where mandatory law does not permit such limitation."] },
      { title: "8. Privacy", body: ["Personal data is processed according to the Privacy Notice. We do not sell personal data. Users should avoid publishing unnecessary personal data in listings or messages."] },
      { title: "9. Changes", body: ["We may update these terms when the service or law changes. Material changes are announced in the service or by email before they take effect."] },
      { title: "10. Governing law and contact", body: ["Finnish law applies. Questions: info@maskines.com"] }
    ]
  },
  sv: {
    back: "Tillbaka", eyebrow: "Tjänstevillkor", title: "Användarvillkor", updated: "Uppdaterad 29.8.2026", privacy: "Integritetspolicy", summaryLabel: "Sammanfattning",
    summary: [{ title: "Säljaren ansvarar", text: "Uppgifter, pris, bilder och beskrivning ska vara korrekta." }, { title: "Affären sker mellan användare", text: "Maskines är plattformen. Köpare och säljare avtalar om betalning och leverans." }, { title: "Använd tjänsten rättvist", text: "Bedrägeri, trakasserier och olagligt innehåll kan tas bort." }],
    sections: [
      { title: "1. Tjänsten", body: ["Maskines är en marknadsplats för reservdelar och tillbehör till snöskotrar, fyrhjulingar, motocross och mopeder."] },
      { title: "2. Konto", body: ["Annonser, meddelanden och vissa funktioner kräver konto. Du ansvarar för korrekta uppgifter och säker inloggning.", "Kontot är personligt eller företagsbundet och får inte överlåtas utan tillstånd."] },
      { title: "3. Annonser", body: ["Säljaren ansvarar för annonsens innehåll. Skick, passform, pris, plats och bilder ska vara sanningsenliga.", "Förbjudet innehåll:"], bullets: ["stulna eller olagliga produkter", "vilseledande pris eller skick", "obehörig användning av annans material", "bedrägliga omdirigeringar"] },
      { title: "4. Handel", body: ["Maskines tillhandahåller marknadsplatsen och kan tekniskt förmedla betalningen men är inte produktens säljare eller part i köpet. Säljaren ansvarar för produktuppgifter, skick, leverans, returer, reklamationer och återbetalningar. Tvingande konsumentlagstiftning gäller oförändrad."] },
      { title: "5. Betalfunktioner", body: ["Betalda funktioner visas innan betalning. Digitala tjänster återbetalas inte efter aktivering om inte tvingande lag kräver det."] },
      { title: "6. Säkerhet", body: ["Tjänsten får inte användas för bedrägeri, trakasserier, spam, skadliga länkar eller missbruk av personuppgifter."] },
      { title: "7. Ansvar", body: ["Maskines ansvarar för sin egen plattformstjänst enligt tvingande lag, men inte för säljarens produkt eller säljarens leverans-, retur-, reklamations- eller återbetalningsskyldigheter. Ingenting i villkoren begränsar rättigheter eller ansvar som inte får begränsas enligt tvingande lag."] },
      { title: "8. Integritet", body: ["Personuppgifter behandlas enligt integritetspolicyn. Vi säljer inte personuppgifter."] },
      { title: "9. Ändringar", body: ["Villkoren kan uppdateras när tjänsten eller lagen ändras. Väsentliga ändringar meddelas i tjänsten eller via e-post."] },
      { title: "10. Lag och kontakt", body: ["Finsk lag gäller. Frågor: info@maskines.com"] }
    ]
  },
  no: {
    back: "Tilbake", eyebrow: "Vilkår", title: "Brukervilkår", updated: "Oppdatert 29.8.2026", privacy: "Personvernerklæring", summaryLabel: "Sammendrag",
    summary: [{ title: "Selger har ansvar", text: "Opplysninger, pris, bilder og beskrivelse må være korrekte." }, { title: "Handel skjer mellom brukere", text: "Maskines er plattformen. Kjøper og selger avtaler betaling og levering." }, { title: "Bruk tjenesten rettferdig", text: "Svindel, trakassering og ulovlig innhold kan fjernes." }],
    sections: [
      { title: "1. Tjenesten", body: ["Maskines er en markedsplass for reservedeler og tilbehør til snøscootere, ATV-er, motocross og mopeder."] },
      { title: "2. Konto", body: ["Annonser, meldinger og enkelte funksjoner krever konto. Du er ansvarlig for korrekte opplysninger og sikker innlogging."] },
      { title: "3. Annonser", body: ["Selger er ansvarlig for annonsen. Tilstand, passform, pris, sted og bilder skal være riktige."], bullets: ["stjålne eller ulovlige varer", "villedende pris eller tilstand", "uautorisert bruk av andres materiale", "svindelrettede lenker"] },
      { title: "4. Handel", body: ["Maskines tilbyr markedsplassen og kan teknisk formidle betalingen, men er ikke selger av produktet eller part i handelen. Selgeren er ansvarlig for produktopplysninger, tilstand, levering, returer, reklamasjoner og refusjoner. Ufravikelig forbrukerlovgivning gjelder uendret."] },
      { title: "5. Betalte funksjoner", body: ["Betalte funksjoner vises før betaling og refunderes ikke etter aktivering med mindre loven krever det."] },
      { title: "6. Sikkerhet", body: ["Tjenesten må ikke brukes til svindel, trakassering, spam, skadevare eller misbruk av personopplysninger."] },
      { title: "7. Ansvar", body: ["Maskines er ansvarlig for sin egen plattformstjeneste etter ufravikelig lov, men ikke for selgerens produkt eller selgerens leverings-, retur-, reklamasjons- eller refusjonsforpliktelser. Ingenting i vilkårene begrenser rettigheter eller ansvar som ikke kan begrenses etter ufravikelig lov."] },
      { title: "8. Personvern", body: ["Personopplysninger behandles etter personvernerklæringen. Vi selger ikke personopplysninger."] },
      { title: "9. Endringer", body: ["Vilkårene kan oppdateres når tjenesten eller loven endres. Vesentlige endringer varsles."] },
      { title: "10. Lov og kontakt", body: ["Finsk lov gjelder. Spørsmål: info@maskines.com"] }
    ]
  },
};

function stripSectionNumber(title: string) {
  return title.replace(/^\d+\.\s*/, "");
}

export default function TermsPage() {
  const { locale } = useLanguage();
  const copy = termsCopy[locale];

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
          {copy.summary.map((item, index) => (
            <div key={item.title} className="terms-summary-item">
              <strong>
                <span className="legal-number">{index + 1}</span>
                <span>{item.title}</span>
              </strong>
              <span>{item.text}</span>
            </div>
          ))}
        </section>
        <div className="terms-content">
          {copy.sections.map((section) => (
            <details key={section.title} className="terms-section legal-accordion-item">
              <summary>
                <span>{stripSectionNumber(section.title)}</span>
                <span className="legal-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="legal-accordion-body">
                {section.body.map((text) => <p key={text}>{text}</p>)}
                {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
              </div>
            </details>
          ))}
        </div>
        <p className="legal-updated-footer">{copy.updated}</p>
      </article>

      <style>{`
        .terms-clean-page {
          color: #f4f8fc;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .terms-clean-page .terms-shell {
          background: transparent;
          border: 0;
          box-shadow: none;
          display: grid;
          gap: 18px;
          margin: 0 auto;
          max-width: 980px;
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
          background: rgba(255, 122, 26, 0.14);
          border: 1px solid rgba(255, 122, 26, 0.34);
          border-radius: 999px;
          color: #ffb45f;
          display: inline-flex;
          font-size: 12px;
          font-weight: 950;
          margin-bottom: 14px;
          padding: 6px 10px;
          width: fit-content;
        }

        .terms-clean-page h1 {
          color: #fff;
          font-size: clamp(48px, 7vw, 82px);
          letter-spacing: 0;
          line-height: 0.95;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .terms-clean-page .terms-hero p {
          color: rgba(215, 226, 238, 0.72);
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
          background: rgba(15, 33, 53, 0.86);
          border: 1px solid rgba(255, 122, 26, 0.32);
          border-radius: 8px;
          color: #f4f8fc;
          display: inline-flex;
          gap: 8px;
          box-shadow: none;
          font-weight: 950;
          min-height: 42px;
          padding: 0 14px;
          text-decoration: none;
        }

        .terms-clean-page .terms-back {
          border-color: rgba(151, 178, 205, 0.2);
        }

        .terms-clean-page .terms-summary {
          background: transparent;
          border: 0;
          box-shadow: none;
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
          padding: 0;
          width: 100%;
        }

        .terms-clean-page .terms-summary-item {
          background: linear-gradient(135deg, rgba(12, 29, 42, 0.96), rgba(5, 18, 31, 0.98));
          border: 1px solid rgba(92, 132, 166, 0.26);
          border-radius: 8px;
          box-shadow: 0 18px 50px rgba(0, 5, 14, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03);
          display: grid;
          gap: 12px;
          min-width: 0;
          padding: clamp(18px, 3vw, 26px);
          overflow: visible;
        }

        .terms-clean-page .terms-summary-item strong {
          overflow-wrap: anywhere;
        }

        .terms-clean-page .terms-summary-item span {
          min-width: 0;
          overflow-wrap: anywhere;
          white-space: normal;
        }

        .terms-clean-page .terms-content {
          background: transparent;
          border: 0;
          box-shadow: none;
          display: grid;
          gap: 12px;
        }

        .terms-clean-page .terms-section {
          background: linear-gradient(135deg, rgba(12, 29, 42, 0.96), rgba(5, 18, 31, 0.98));
          border: 1px solid rgba(92, 132, 166, 0.26);
          border-radius: 8px;
          box-shadow: 0 18px 50px rgba(0, 5, 14, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03);
          color: #f4f8fc;
          display: grid;
          gap: 12px;
          min-width: 0;
          padding: clamp(18px, 3vw, 26px);
        }

        .terms-clean-page .terms-section h2 {
          border-top: 0;
          overflow-wrap: anywhere;
          padding-top: 0;
        }

        .terms-clean-page .terms-section p,
        .terms-clean-page .terms-section li {
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
          .terms-clean-page .terms-summary-item {
            padding: 16px;
          }

          .terms-clean-page .terms-summary-item strong,
          .terms-clean-page .terms-section h2 {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
