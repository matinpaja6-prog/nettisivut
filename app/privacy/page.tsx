"use client";

import Link from "@/app/components/LocalizedLink";
import { useLanguage, type Locale } from "@/lib/i18n";
import { COMPANY_IDENTITY, companyIdentityCopy } from "@/lib/company-identity";

function registeredCompanyDetails(locale: Locale) {
  const copy = companyIdentityCopy[locale];
  return `${copy.businessId}: ${COMPANY_IDENTITY.businessId}. ${copy.address}: ${COMPANY_IDENTITY.registeredAddress}.`;
}

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
  updated: "Päivitetty 2.9.2026",
  terms: "Käyttöehdot",
  summaryLabel: "Tietosuojan tiivistelmä",
  summary: [
    { title: "Tietoja käytetään palvelun toimintaan", text: "Käsittelemme tietoja tilin, ilmoitusten, viestien ja turvallisen kaupankäynnin mahdollistamiseksi." },
    { title: "Säilytysajat on rajattu", text: "Tietoja säilytetään vain niin kauan kuin palvelu, laki tai väärinkäytösten selvittäminen edellyttää." },
    { title: "Tietoja ei myydä", text: "Emme myy henkilötietoja. Palveluntarjoajia käytetään vain palvelun toteuttamiseen." },
    { title: "GDPR-oikeudet kuuluvat sinulle", text: "Voit pyytää pääsyä tietoihin, korjausta, poistoa, rajoittamista, siirtoa tai vastustaa käsittelyä." }
  ],
  sections: [
    { title: "1. Rekisterinpitäjä", body: ["Maskines-palvelun ylläpitäjä ja rekisterinpitäjä on Arctic Parts Oy. Tietosuoja-asioissa voit ottaa yhteyttä osoitteeseen info@maskines.com.", registeredCompanyDetails("fi"), companyIdentityCopy.fi.sellerRole] },
    { title: "2. Kerättävät tiedot", body: ["Keräämme vain palvelun kannalta tarpeellisia tietoja."], bullets: ["tilin perustiedot, kuten nimi, sähköposti, puhelinnumero ja sijainti", "yritystilin tiedot, kuten yrityksen nimi ja y-tunnus", "ilmoitusten kuvat, hinnat, varaosatiedot, kuvaukset ja sijainnit", "viestit, arvostelut, ilmoitukset ja turvallisuuteen liittyvät lokitiedot"] },
    { title: "3. Käyttötarkoitukset", body: ["Tietoja käytetään käyttäjätilin ylläpitoon, ilmoitusten julkaisuun, ostajan ja myyjän yhteydenpitoon, asiakastukeen, turvallisuuteen, väärinkäytösten estoon ja palvelun kehittämiseen."] },
    { title: "4. Oikeusperuste", body: ["Käsittely perustuu sopimuksen toteuttamiseen, lakisääteisiin velvoitteisiin, oikeutettuun etuun palvelun turvallisuuden vuoksi sekä suostumukseen silloin, kun suostumusta erikseen pyydetään."] },
    { title: "5. EU:n yleinen tietosuoja-asetus (GDPR)", body: ["Maskines käsittelee henkilötietoja GDPR:n periaatteiden mukaisesti: lainmukaisesti, kohtuullisesti, läpinäkyvästi ja vain määriteltyihin tarkoituksiin."], bullets: ["tietojen minimointi", "säilytyksen rajoittaminen", "eheys ja luottamuksellisuus", "osoitusvelvollisuus"] },
    { title: "6. Säilytysajat", body: ["Käyttäjätilin tiedot säilytetään tilin voimassaolon ajan. Poiston jälkeen tiedot poistetaan tai anonymisoidaan kohtuullisessa ajassa, ellei laki, riita tai väärinkäytösten selvittäminen edellytä pidempää säilytystä."] },
    { title: "7. Vastaanottajat ja siirrot", body: ["Emme myy henkilötietoja. Tietoja voidaan käsitellä teknisten palveluntarjoajien, kuten tietokanta-, kirjautumis-, maksu-, sähköposti- tai ylläpitopalveluiden kautta. Jos tietoja siirretään EU/ETA-alueen ulkopuolelle, käytämme GDPR:n mukaisia suojakeinoja."] },
    { title: "8. Rekisteröidyn oikeudet", body: ["Sinulla on oikeus saada pääsy tietoihin, korjata virheellisiä tietoja, pyytää poistamista, rajoittaa käsittelyä, vastustaa käsittelyä ja saada tietyt tiedot koneellisesti luettavassa muodossa. Lähetä pyyntö osoitteeseen info@maskines.com."] },
    { title: "9. Valitusoikeus ja lisätieto", body: ["Jos katsot, että henkilötietojasi käsitellään lainvastaisesti, voit olla yhteydessä Maskinesiin tai tehdä valituksen tietosuojavaltuutetun toimistolle."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "Euroopan komissio" }, { href: "https://tietosuoja.fi/", label: "Tietosuojavaltuutetun toimisto" }] },
    { title: "10. Evästeet ja muutokset", body: ["Palvelu käyttää välttämättömiä evästeitä ja paikallista tallennusta kirjautumiseen, istuntoon, kielivalintaan ja turvallisuuteen. Päivitämme selostetta, kun palvelu tai käsittely muuttuu."] },
    { title: "11. Maskinesin rooli kaupoissa", body: ["Maskines käsittelee tilaus-, maksu-, viesti- ja reklamaatiotietoja markkinapaikan teknisen toteuttamisen, turvallisuuden, asiakastuen ja lakisääteisten velvoitteiden vuoksi. Alustan tekninen rooli ei muuta ilmoituksessa nimetyn myyjän velvoitteita.", "Ilmoituksessa nimetty myyjä vastaa tuotteesta, sen tiedoista ja kunnosta sekä toimituksista, palautuksista, reklamaatioista, hyvityksistä ja muista kauppaan liittyvistä myyjän velvoitteista. Maskines vastaa omasta alustapalvelustaan sovellettavan pakottavan lain mukaisesti. Tämä vastuunjako ei rajoita rekisteröidyn tietosuojaoikeuksia tai muita pakottavaan lainsäädäntöön perustuvia oikeuksia."] }
  ]
};

const privacyCopy: Record<Locale, LegalCopy> = {
  fi: fiCopy,
  en: {
    ...fiCopy,
    title: "Privacy Notice",
    updated: "Updated 2 September 2026",
    terms: "Terms of Use",
    summaryLabel: "Privacy summary",
    summary: [
      { title: "Data is used to run the service", text: "We process data to provide accounts, listings, messages and safer trading." },
      { title: "Retention is limited", text: "Data is kept only as long as needed for the service, law or misuse investigations." },
      { title: "Data is not sold", text: "We do not sell personal data. Providers are used only to operate the service." },
      { title: "GDPR rights belong to you", text: "You may request access, correction, erasure, restriction, portability or object to processing." }
    ],
    sections: [
      { title: "1. Controller", body: ["Arctic Parts Oy operates Maskines and is the data controller. For privacy matters contact info@maskines.com.", registeredCompanyDetails("en"), companyIdentityCopy.en.sellerRole] },
      { title: "2. Data we collect", body: ["We collect only data necessary for the service."], bullets: ["account details such as name, email, phone and location", "company account details such as company name and business ID", "listing photos, prices, part details, descriptions and locations", "messages, reviews, notifications and security logs"] },
      { title: "3. Purposes", body: ["Data is used for account management, publishing listings, buyer-seller communication, customer support, security, preventing misuse and improving the service."] },
      { title: "4. Legal basis", body: ["Processing is based on contract performance, legal obligations, legitimate interests for service security and consent where consent is requested."] },
      { title: "5. EU General Data Protection Regulation (GDPR)", body: ["Maskines processes personal data according to GDPR principles: lawfully, fairly, transparently and only for defined purposes."], bullets: ["data minimisation", "storage limitation", "integrity and confidentiality", "accountability"] },
      { title: "6. Retention", body: ["Account data is kept while the account exists. After deletion, data is removed or anonymised within a reasonable time unless law, disputes or misuse investigations require longer retention."] },
      { title: "7. Recipients and transfers", body: ["We do not sell personal data. Data may be processed by technical providers such as database, login, payment, email or hosting services. Transfers outside the EU/EEA use GDPR safeguards."] },
      { title: "8. Your rights", body: ["You have the right to access, rectify, erase, restrict, object and receive certain data in machine-readable form. Send requests to info@maskines.com."] },
      { title: "9. Complaint and more information", body: ["If you believe your data is processed unlawfully, contact Maskines or lodge a complaint with a supervisory authority."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "European Commission" }, { href: "https://tietosuoja.fi/", label: "Finnish Data Protection Ombudsman" }] },
      { title: "10. Cookies and changes", body: ["The service uses necessary cookies and local storage for login, sessions, language choice and security. We update this notice when the service or processing changes."] },
      { title: "11. Maskines' role in transactions", body: ["Maskines processes order, payment, message and complaint data to operate the marketplace, maintain security, provide support and meet legal obligations. The platform's technical role does not change the obligations of the seller identified in the listing.", "The seller identified in the listing is responsible for the product, its information and condition, delivery, returns, complaints, refunds and other seller obligations related to the sale. Maskines is responsible for its own platform service as required by mandatory applicable law. This allocation does not limit data protection rights or other mandatory statutory rights."] }
    ]
  },
  sv: {
    title: "Integritetspolicy", updated: "Uppdaterad 2 september 2026", terms: "Användarvillkor", summaryLabel: "Sammanfattning av dataskyddet",
    summary: [
      { title: "Uppgifter används för tjänsten", text: "Vi behandlar uppgifter för konton, annonser, meddelanden och tryggare handel." },
      { title: "Lagringstiderna är begränsade", text: "Uppgifter sparas bara så länge tjänsten, lagen eller utredning av missbruk kräver." },
      { title: "Uppgifter säljs inte", text: "Vi säljer inte personuppgifter. Tjänsteleverantörer används för att tillhandahålla tjänsten." },
      { title: "Du har rättigheter enligt GDPR", text: "Du kan begära tillgång, rättelse, radering, begränsning och överföring eller invända mot behandlingen." }
    ],
    sections: [
      { title: "1. Personuppgiftsansvarig", body: ["Arctic Parts Oy driver Maskines och är personuppgiftsansvarig. Kontakta info@maskines.com i dataskyddsfrågor.", registeredCompanyDetails("sv"), companyIdentityCopy.sv.sellerRole] },
      { title: "2. Uppgifter som samlas in", body: ["Vi samlar bara in uppgifter som behövs för tjänsten."], bullets: ["kontouppgifter såsom namn, e-postadress, telefonnummer och ort", "företagsuppgifter såsom företagsnamn och FO-nummer", "annonsbilder, priser, reservdelsuppgifter, beskrivningar och platser", "meddelanden, recensioner, aviseringar och säkerhetsloggar"] },
      { title: "3. Ändamål", body: ["Uppgifterna används för kontohantering, publicering av annonser, kontakt mellan köpare och säljare, kundsupport, säkerhet, förebyggande av missbruk och utveckling av tjänsten."] },
      { title: "4. Rättslig grund", body: ["Behandlingen grundar sig på fullgörande av avtal, rättsliga förpliktelser, berättigade intressen för tjänstens säkerhet och samtycke när detta begärs separat."] },
      { title: "5. EU:s dataskyddsförordning (GDPR)", body: ["Maskines behandlar personuppgifter enligt GDPR:s principer: lagligt, korrekt, öppet och bara för angivna ändamål."], bullets: ["uppgiftsminimering", "lagringsminimering", "integritet och konfidentialitet", "ansvarsskyldighet"] },
      { title: "6. Lagringstider", body: ["Kontouppgifter sparas så länge kontot finns. Efter radering tas uppgifterna bort eller anonymiseras inom rimlig tid, om inte lag, tvister eller utredning av missbruk kräver längre lagring."] },
      { title: "7. Mottagare och överföringar", body: ["Vi säljer inte personuppgifter. Tekniska leverantörer av exempelvis databaser, inloggning, betalning, e-post eller drift kan behandla uppgifter. Vid överföringar utanför EU/EES används skyddsåtgärder enligt GDPR."] },
      { title: "8. Dina rättigheter", body: ["Du har rätt att få tillgång till, rätta och radera uppgifter, begränsa eller invända mot behandlingen och få vissa uppgifter i maskinläsbar form. Skicka din begäran till info@maskines.com."] },
      { title: "9. Klagomål och mer information", body: ["Om du anser att dina personuppgifter behandlas olagligt kan du kontakta Maskines eller lämna klagomål till dataskyddsombudsmannens byrå."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "Europeiska kommissionen" }, { href: "https://tietosuoja.fi/", label: "Dataskyddsombudsmannens byrå" }] },
      { title: "10. Kakor och ändringar", body: ["Tjänsten använder nödvändiga kakor och lokal lagring för inloggning, sessioner, språkval och säkerhet. Vi uppdaterar policyn när tjänsten eller behandlingen ändras."] },
      { title: "11. Maskines roll i handeln", body: ["Maskines behandlar order-, betalnings-, meddelande- och reklamationsuppgifter för att driva marknadsplatsen, upprätthålla säkerheten, erbjuda support och uppfylla rättsliga förpliktelser. Plattformens tekniska roll ändrar inte skyldigheterna för säljaren som anges i annonsen.", "Säljaren som anges i annonsen ansvarar för produkten, dess uppgifter och skick, leverans, returer, reklamationer, återbetalningar och övriga säljarförpliktelser. Maskines ansvarar för sin egen plattformstjänst enligt tvingande lag. Fördelningen begränsar inte dataskyddsrättigheter eller andra tvingande lagstadgade rättigheter."] }
    ]
  },
  no: {
    title: "Personvernerklæring", updated: "Oppdatert 2. september 2026", terms: "Brukervilkår", summaryLabel: "Personvern i korthet",
    summary: [
      { title: "Opplysninger brukes til å drive tjenesten", text: "Vi behandler opplysninger for kontoer, annonser, meldinger og tryggere handel." },
      { title: "Lagringstiden er begrenset", text: "Opplysninger lagres bare så lenge tjenesten, loven eller undersøkelser av misbruk krever det." },
      { title: "Opplysninger selges ikke", text: "Vi selger ikke personopplysninger. Leverandører brukes for å levere tjenesten." },
      { title: "Du har rettigheter etter GDPR", text: "Du kan be om innsyn, retting, sletting, begrensning og overføring eller protestere mot behandlingen." }
    ],
    sections: [
      { title: "1. Behandlingsansvarlig", body: ["Arctic Parts Oy driver Maskines og er behandlingsansvarlig. Kontakt info@maskines.com ved spørsmål om personvern.", registeredCompanyDetails("no"), companyIdentityCopy.no.sellerRole] },
      { title: "2. Opplysninger vi samler inn", body: ["Vi samler bare inn opplysninger som er nødvendige for tjenesten."], bullets: ["kontoopplysninger som navn, e-postadresse, telefonnummer og sted", "bedriftsopplysninger som bedriftsnavn og organisasjonsnummer", "annonsebilder, priser, deleopplysninger, beskrivelser og steder", "meldinger, anmeldelser, varsler og sikkerhetslogger"] },
      { title: "3. Formål", body: ["Opplysningene brukes til kontoadministrasjon, publisering av annonser, kontakt mellom kjøpere og selgere, kundestøtte, sikkerhet, forebygging av misbruk og utvikling av tjenesten."] },
      { title: "4. Rettslig grunnlag", body: ["Behandlingen bygger på oppfyllelse av avtaler, rettslige plikter, berettigede interesser knyttet til tjenestens sikkerhet og samtykke når dette innhentes særskilt."] },
      { title: "5. EUs personvernforordning (GDPR)", body: ["Maskines behandler personopplysninger etter GDPR-prinsippene: lovlig, rettferdig, åpent og bare for angitte formål."], bullets: ["dataminimering", "lagringsbegrensning", "integritet og konfidensialitet", "ansvarlighet"] },
      { title: "6. Lagringstid", body: ["Kontoopplysninger lagres så lenge kontoen finnes. Etter sletting fjernes eller anonymiseres opplysningene innen rimelig tid, med mindre loven, tvister eller undersøkelser av misbruk krever lengre lagring."] },
      { title: "7. Mottakere og overføringer", body: ["Vi selger ikke personopplysninger. Tekniske leverandører av blant annet database-, innloggings-, betalings-, e-post- og driftstjenester kan behandle opplysninger. Ved overføringer utenfor EU/EØS brukes garantier i samsvar med GDPR."] },
      { title: "8. Dine rettigheter", body: ["Du har rett til innsyn, retting, sletting, begrensning, å protestere og å få visse opplysninger i maskinlesbar form. Send forespørsler til info@maskines.com."] },
      { title: "9. Klager og mer informasjon", body: ["Hvis du mener at personopplysningene dine behandles ulovlig, kan du kontakte Maskines eller klage til det finske datatilsynet."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "Europakommisjonen" }, { href: "https://tietosuoja.fi/", label: "Det finske datatilsynet" }] },
      { title: "10. Informasjonskapsler og endringer", body: ["Tjenesten bruker nødvendige informasjonskapsler og lokal lagring for innlogging, økter, språkvalg og sikkerhet. Vi oppdaterer erklæringen når tjenesten eller behandlingen endres."] },
      { title: "11. Maskines' rolle i handelen", body: ["Maskines behandler ordre-, betalings-, meldings- og reklamasjonsopplysninger for å drive markedsplassen, ivareta sikkerhet, tilby kundestøtte og oppfylle rettslige plikter. Plattformens tekniske rolle endrer ikke pliktene til selgeren som er oppgitt i annonsen.", "Selgeren som er angitt i annonsen, er ansvarlig for produktet, opplysningene og tilstanden, levering, returer, reklamasjoner, refusjoner og øvrige selgerplikter. Maskines er ansvarlig for sin egen plattformtjeneste etter ufravikelig lov. Fordelingen begrenser ikke personvernrettigheter eller andre ufravikelige lovfestede rettigheter."] }
    ]
  },
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
          {copy.sections.map((section) => (
            <details key={section.title} className="privacy-section legal-accordion-item">
              <summary>
                <span>{stripSectionNumber(section.title)}</span>
                <span className="legal-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="legal-accordion-body">
                {section.body.map((text) => <p key={text}>{text}</p>)}
                {section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}
                {section.links ? (
                  <p className="legal-source-links">
                    {section.links.map((link) => (
                      <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                    ))}
                  </p>
                ) : null}
              </div>
            </details>
          ))}
        </div>
        <p className="legal-updated-footer">{copy.updated}</p>
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
          background: linear-gradient(135deg, rgba(12, 29, 42, 0.96), rgba(5, 18, 31, 0.98));
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
          background: linear-gradient(135deg, rgba(12, 29, 42, 0.96), rgba(5, 18, 31, 0.98));
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
          margin-top: 14px;
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
