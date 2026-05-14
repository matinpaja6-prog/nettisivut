"use client";

import Link from "next/link";
import { ArrowLeft, Database, FileCheck2, LockKeyhole, Scale, ShieldCheck } from "lucide-react";
import { useLanguage, type Locale } from "@/lib/i18n";

type LegalCopy = {
  back: string; eyebrow: string; title: string; updated: string; terms: string; heroTitle: string; heroText: string; summaryLabel: string;
  summary: Array<{ title: string; text: string }>;
  sections: Array<{ title: string; body: string[]; bullets?: string[]; links?: Array<{ href: string; label: string }> }>;
};

const privacyCopy: Record<Locale, LegalCopy> = {
  fi: {
    back: "Takaisin", eyebrow: "Tietosuoja", title: "Tietosuojaseloste", updated: "Päivitetty 14.5.2026 · EU GDPR -yhteensopiva seloste", terms: "Käyttöehdot", heroTitle: "GDPR", heroText: "EU:n tietosuoja-asetuksen mukainen informointi käyttäjälle.", summaryLabel: "Tietosuojan tiivistelmä",
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
      { title: "5. EU:n yleinen tietosuoja-asetus (GDPR)", body: ["Arctic Parts käsittelee henkilötietoja GDPR:n periaatteiden mukaisesti: lainmukaisesti, kohtuullisesti, läpinäkyvästi ja vain määriteltyihin tarkoituksiin."], bullets: ["tietojen minimointi", "säilytyksen rajoittaminen", "eheys ja luottamuksellisuus", "osoitusvelvollisuus"] },
      { title: "6. Säilytysajat", body: ["Käyttäjätilin tiedot säilytetään tilin voimassaolon ajan. Poiston jälkeen tiedot poistetaan tai anonymisoidaan kohtuullisessa ajassa, ellei laki, riita tai väärinkäytösten selvittäminen edellytä pidempää säilytystä."] },
      { title: "7. Vastaanottajat ja siirrot", body: ["Emme myy henkilötietoja. Tietoja voidaan käsitellä teknisten palveluntarjoajien, kuten tietokanta-, kirjautumis-, maksu-, sähköposti- tai ylläpitopalveluiden kautta. Jos tietoja siirretään EU/ETA-alueen ulkopuolelle, käytämme GDPR:n mukaisia suojakeinoja."] },
      { title: "8. Rekisteröidyn oikeudet", body: ["Sinulla on oikeus saada pääsy tietoihin, korjata virheellisiä tietoja, pyytää poistamista, rajoittaa käsittelyä, vastustaa käsittelyä ja saada tietyt tiedot koneellisesti luettavassa muodossa. Lähetä pyyntö osoitteeseen info@arcticparts.fi."] },
      { title: "9. Valitusoikeus ja lisätieto", body: ["Jos katsot, että henkilötietojasi käsitellään lainvastaisesti, voit olla yhteydessä Arctic Partsiin tai tehdä valituksen tietosuojavaltuutetun toimistolle."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "Euroopan komissio" }, { href: "https://tietosuoja.fi/", label: "Tietosuojavaltuutetun toimisto" }] },
      { title: "10. Evästeet ja muutokset", body: ["Palvelu käyttää välttämättömiä evästeitä ja paikallista tallennusta kirjautumiseen, istuntoon, kielivalintaan ja turvallisuuteen. Päivitämme selostetta, kun palvelu tai käsittely muuttuu."] }
    ]
  },
  en: {
    back: "Back", eyebrow: "Privacy", title: "Privacy Notice", updated: "Updated 14 May 2026 · EU GDPR compliant notice", terms: "Terms of Use", heroTitle: "GDPR", heroText: "Information for users under the EU General Data Protection Regulation.", summaryLabel: "Privacy summary",
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
      { title: "5. EU General Data Protection Regulation (GDPR)", body: ["Arctic Parts processes personal data according to GDPR principles: lawfully, fairly, transparently and only for defined purposes."], bullets: ["data minimisation", "storage limitation", "integrity and confidentiality", "accountability"] },
      { title: "6. Retention", body: ["Account data is kept while the account exists. After deletion, data is removed or anonymised within a reasonable time unless law, disputes or misuse investigations require longer retention."] },
      { title: "7. Recipients and transfers", body: ["We do not sell personal data. Data may be processed by technical providers such as database, login, payment, email or hosting services. Transfers outside the EU/EEA use GDPR safeguards."] },
      { title: "8. Your rights", body: ["You have the right to access, rectify, erase, restrict, object and receive certain data in machine-readable form. Send requests to info@arcticparts.fi."] },
      { title: "9. Complaint and more information", body: ["If you believe your data is processed unlawfully, contact Arctic Parts or lodge a complaint with a supervisory authority."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "European Commission" }, { href: "https://tietosuoja.fi/", label: "Finnish Data Protection Ombudsman" }] },
      { title: "10. Cookies and changes", body: ["The service uses necessary cookies and local storage for login, sessions, language choice and security. We update this notice when the service or processing changes."] }
    ]
  },
  sv: {
    back: "Tillbaka", eyebrow: "Integritet", title: "Integritetspolicy", updated: "Uppdaterad 14.5.2026 · EU GDPR-anpassad", terms: "Användarvillkor", heroTitle: "GDPR", heroText: "Information enligt EU:s dataskyddsförordning.", summaryLabel: "Integritetssammanfattning",
    summary: [{ title: "Data används för tjänsten", text: "Vi behandlar data för konton, annonser, meddelanden och tryggare handel." }, { title: "Lagring är begränsad", text: "Data sparas bara så länge tjänsten, lagen eller missbruksutredningar kräver." }, { title: "Data säljs inte", text: "Vi säljer inte personuppgifter." }, { title: "Du har GDPR-rättigheter", text: "Du kan begära åtkomst, rättelse, radering, begränsning, dataportabilitet eller invända." }],
    sections: [
      { title: "1. Personuppgiftsansvarig", body: ["Personuppgiftsansvarig är Arctic Parts Oy. Kontakta info@arcticparts.fi i dataskyddsfrågor."] },
      { title: "2. Uppgifter", body: ["Vi samlar endast in nödvändiga uppgifter."], bullets: ["kontouppgifter", "företagsuppgifter", "annonsuppgifter och bilder", "meddelanden, recensioner och säkerhetsloggar"] },
      { title: "3. Syften", body: ["Uppgifter används för konton, annonser, kommunikation, support, säkerhet, missbruksförebyggande och utveckling."] },
      { title: "4. Rättslig grund", body: ["Behandlingen baseras på avtal, rättsliga skyldigheter, berättigat intresse och samtycke där det begärs."] },
      { title: "5. GDPR", body: ["Arctic Parts behandlar personuppgifter enligt GDPR-principerna: lagligt, korrekt, öppet och för definierade ändamål."], bullets: ["dataminimering", "lagringsbegränsning", "integritet och konfidentialitet", "ansvarsskyldighet"] },
      { title: "6. Lagring", body: ["Kontouppgifter sparas medan kontot finns och raderas eller anonymiseras därefter om inte lag eller utredning kräver längre lagring."] },
      { title: "7. Mottagare och överföringar", body: ["Vi säljer inte data. Tekniska leverantörer kan behandla data. Överföringar utanför EU/EES skyddas enligt GDPR."] },
      { title: "8. Dina rättigheter", body: ["Du har rätt till åtkomst, rättelse, radering, begränsning, invändning och dataportabilitet. Kontakta info@arcticparts.fi."] },
      { title: "9. Klagomål", body: ["Du kan kontakta Arctic Parts eller lämna klagomål till en tillsynsmyndighet."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "Europeiska kommissionen" }, { href: "https://tietosuoja.fi/", label: "Dataombudsmannen" }] },
      { title: "10. Cookies och ändringar", body: ["Nödvändiga cookies och lokal lagring används för inloggning, session, språkval och säkerhet."] }
    ]
  },
  no: {
    back: "Tilbake", eyebrow: "Personvern", title: "Personvernerklæring", updated: "Oppdatert 14.5.2026 · EU GDPR-tilpasset", terms: "Brukervilkår", heroTitle: "GDPR", heroText: "Informasjon etter EUs personvernforordning.", summaryLabel: "Personvernsammendrag",
    summary: [{ title: "Data brukes for tjenesten", text: "Vi behandler data for kontoer, annonser, meldinger og tryggere handel." }, { title: "Lagring er begrenset", text: "Data lagres bare så lenge tjenesten, loven eller undersøkelser krever." }, { title: "Data selges ikke", text: "Vi selger ikke personopplysninger." }, { title: "Du har GDPR-rettigheter", text: "Du kan be om innsyn, retting, sletting, begrensning, portabilitet eller protestere." }],
    sections: [
      { title: "1. Behandlingsansvarlig", body: ["Behandlingsansvarlig er Arctic Parts Oy. Kontakt info@arcticparts.fi om personvern."] },
      { title: "2. Data", body: ["Vi samler bare nødvendige data."], bullets: ["kontoopplysninger", "bedriftsopplysninger", "annonseopplysninger og bilder", "meldinger, vurderinger og sikkerhetslogger"] },
      { title: "3. Formål", body: ["Data brukes til kontoer, annonser, kommunikasjon, support, sikkerhet, misbruksforebygging og utvikling."] },
      { title: "4. Rettsgrunnlag", body: ["Behandlingen bygger på avtale, lovpålagte plikter, berettiget interesse og samtykke der det innhentes."] },
      { title: "5. GDPR", body: ["Arctic Parts behandler personopplysninger etter GDPR-prinsippene: lovlig, rettferdig, åpent og for definerte formål."], bullets: ["dataminimering", "lagringsbegrensning", "integritet og konfidensialitet", "ansvarlighet"] },
      { title: "6. Lagring", body: ["Kontodata lagres mens kontoen finnes og slettes eller anonymiseres etterpå med mindre lov eller undersøkelser krever lengre lagring."] },
      { title: "7. Mottakere og overføringer", body: ["Vi selger ikke data. Tekniske leverandører kan behandle data. Overføringer utenfor EU/EØS sikres etter GDPR."] },
      { title: "8. Dine rettigheter", body: ["Du har rett til innsyn, retting, sletting, begrensning, protest og dataportabilitet. Kontakt info@arcticparts.fi."] },
      { title: "9. Klage", body: ["Du kan kontakte Arctic Parts eller klage til en tilsynsmyndighet."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "Europakommisjonen" }, { href: "https://tietosuoja.fi/", label: "Datatilsynsmyndighet" }] },
      { title: "10. Informasjonskapsler og endringer", body: ["Nødvendige informasjonskapsler og lokal lagring brukes for innlogging, økt, språkvalg og sikkerhet."] }
    ]
  },
  et: {
    back: "Tagasi", eyebrow: "Privaatsus", title: "Privaatsusteade", updated: "Uuendatud 14.5.2026 · EU GDPR kooskõlas", terms: "Kasutustingimused", heroTitle: "GDPR", heroText: "Teave kasutajale EL-i isikuandmete kaitse üldmääruse alusel.", summaryLabel: "Privaatsuse kokkuvõte",
    summary: [{ title: "Andmeid kasutatakse teenuseks", text: "Töötleme andmeid kontode, kuulutuste, sõnumite ja turvalisema kauplemise jaoks." }, { title: "Säilitamine on piiratud", text: "Andmeid hoitakse ainult nii kaua, kui teenus, seadus või uurimine nõuab." }, { title: "Andmeid ei müüda", text: "Me ei müü isikuandmeid." }, { title: "Sul on GDPR õigused", text: "Võid küsida juurdepääsu, parandamist, kustutamist, piiramist, ülekandmist või esitada vastuväite." }],
    sections: [
      { title: "1. Vastutav töötleja", body: ["Vastutav töötleja on Arctic Parts Oy. Privaatsusküsimustes kirjuta info@arcticparts.fi."] },
      { title: "2. Andmed", body: ["Kogume ainult vajalikke andmeid."], bullets: ["kontoandmed", "ettevõtte andmed", "kuulutuse andmed ja pildid", "sõnumid, arvustused ja turvalogid"] },
      { title: "3. Eesmärgid", body: ["Andmeid kasutatakse kontode, kuulutuste, suhtluse, toe, turvalisuse, väärkasutuse ennetamise ja arenduse jaoks."] },
      { title: "4. Õiguslik alus", body: ["Töötlemine põhineb lepingul, seadusest tulenevatel kohustustel, õigustatud huvil ja nõusolekul, kui seda küsitakse."] },
      { title: "5. GDPR", body: ["Arctic Parts töötleb isikuandmeid GDPR põhimõtete järgi: seaduslikult, õiglaselt, läbipaistvalt ja kindlatel eesmärkidel."], bullets: ["andmete minimeerimine", "säilitamise piiramine", "terviklus ja konfidentsiaalsus", "vastutavus"] },
      { title: "6. Säilitamine", body: ["Kontoandmeid säilitatakse konto olemasolu ajal ning seejärel kustutatakse või anonüümitakse, kui seadus või uurimine ei nõua pikemat säilitamist."] },
      { title: "7. Saajad ja edastamine", body: ["Me ei müü andmeid. Tehnilised teenusepakkujad võivad andmeid töödelda. EL/EMP välised edastused kaitstakse GDPR järgi."] },
      { title: "8. Sinu õigused", body: ["Sul on õigus juurdepääsule, parandamisele, kustutamisele, piiramisele, vastuväitele ja andmete ülekandmisele. Kirjuta info@arcticparts.fi."] },
      { title: "9. Kaebus", body: ["Võid võtta ühendust Arctic Partsiga või esitada kaebuse järelevalveasutusele."], links: [{ href: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en", label: "Euroopa Komisjon" }, { href: "https://tietosuoja.fi/", label: "Andmekaitseasutus" }] },
      { title: "10. Küpsised ja muudatused", body: ["Vajalikud küpsised ja kohalik salvestus toetavad sisselogimist, seanssi, keelevalikut ja turvalisust."] }
    ]
  }
};

export default function PrivacyPage() {
  const { locale } = useLanguage();
  const copy = privacyCopy[locale];
  const icons = [ShieldCheck, Database, LockKeyhole, Scale];

  return (
    <main className="privacy-page legal-page">
      <header className="legal-topbar">
        <Link className="legal-back" href="/"><ArrowLeft size={18} /><span>{copy.back}</span></Link>
        <div className="legal-brand"><span>AP</span><strong>Arctic Parts</strong></div>
      </header>
      <article className="legal-shell">
        <section className="legal-hero">
          <div><span className="legal-eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.updated}</p></div>
          <div className="legal-hero-card"><FileCheck2 size={26} /><strong>{copy.heroTitle}</strong><span>{copy.heroText}</span><Link href="/terms" className="legal-hero-link">{copy.terms}</Link></div>
        </section>
        <section className="legal-summary" aria-label={copy.summaryLabel}>
          {copy.summary.map((item, i) => {
            const Icon = icons[i];
            return <div key={item.title}><Icon size={20} /><strong>{item.title}</strong><span>{item.text}</span></div>;
          })}
        </section>
        <div className="legal-content">
          {copy.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((text) => <p key={text}>{text}</p>)}
              {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
              {section.links && <p className="legal-source-links">{section.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</p>}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
