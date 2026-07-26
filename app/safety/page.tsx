import InfoPage, { type InfoPageCopy } from "@/app/components/InfoPage";
import type { Locale } from "@/lib/i18n";

const copy: Record<Locale, InfoPageCopy> = {
  fi: {
    kicker: "Tuki",
    title: "Turvallinen kauppa",
    lead: "Turvallinen varaosakauppa syntyy selkeistä tiedoista, rauhallisesta viestittelystä ja siitä, että ostaja ja myyjä sopivat asiat kirjallisesti.",
    cards: [
      { title: "Tarkista osa", text: "Varmista sopivuus, kunto, varaosanumero ja kuvat ennen maksua." },
      { title: "Sovi ehdot", text: "Kirjaa maksu, toimitus, nouto ja palautusmahdollisuus viesteihin." },
      { title: "Vältä painostus", text: "Kiire, oudot maksutavat ja palvelun ulkopuolelle ohjaaminen ovat varoitusmerkkejä." }
    ],
    sections: [
      { title: "Ostajalle", body: ["Tarkista myyjän profiili ja pyydä tarvittaessa lisäkuvia osasta, kiinnityskohdista, sarjanumerosta tai kulumista."], bullets: ["älä maksa ennen kuin tiedot ovat selvät", "käytä jäljitettävää maksutapaa", "säilytä keskustelu ja kuitit", "nouda kallis osa mahdollisuuksien mukaan paikan päältä"] },
      { title: "Myyjälle", body: ["Kerro tuotteen todellinen kunto ja pakkaa lähetettävä osa niin, ettei se vaurioidu matkalla."], bullets: ["kuvaa viat avoimesti", "pidä hinta ja saatavuus ajan tasalla", "lähetä seurantatunnus ostajalle", "poista myyty ilmoitus tai merkitse se myydyksi"] },
      { title: "Ilmoita riskistä", body: ["Jos huomaat huijausyrityksen, varastetuksi epäillyn tuotteen tai käyttäjän, joka häiritsee muita, ota yhteyttä tukeen mahdollisimman tarkkojen tietojen kanssa."] }
    ],
    actions: [{ href: "mailto:info@maskines.com", label: "Ilmoita ongelmasta", primary: true }],
    summaryLabel: "Turvallinen kauppa - yhteenveto"
  },
  en: {
    kicker: "Support",
    title: "Safe trading",
    lead: "Safe parts trading comes from clear information, calm messaging and buyer and seller agreeing details in writing.",
    cards: [
      { title: "Check the part", text: "Confirm fitment, condition, part number and photos before payment." },
      { title: "Agree the terms", text: "Write payment, delivery, pickup and return options into the messages." },
      { title: "Avoid pressure", text: "Urgency, unusual payment methods and moving outside the service are warning signs." }
    ],
    sections: [
      { title: "For buyers", body: ["Check the seller profile and ask for more photos of the part, mounting points, serial number or wear if needed."], bullets: ["do not pay before the details are clear", "use a traceable payment method", "keep the conversation and receipts", "pick up an expensive part in person when possible"] },
      { title: "For sellers", body: ["Describe the real condition of the product and pack shipped parts so they are not damaged in transit."], bullets: ["show defects openly", "keep price and availability up to date", "send the tracking code to the buyer", "remove a sold listing or mark it as sold"] },
      { title: "Report a risk", body: ["If you notice a scam attempt, a product suspected to be stolen or a user who disturbs others, contact support with as much detail as possible."] }
    ],
    actions: [{ href: "mailto:info@maskines.com", label: "Report a problem", primary: true }],
    summaryLabel: "Safe trading - summary"
  },
  sv: {
    kicker: "Support",
    title: "Trygg handel",
    lead: "Trygg reservdelshandel bygger på tydlig information, lugn kommunikation och att köpare och säljare kommer överens skriftligt.",
    cards: [
      { title: "Kontrollera delen", text: "Kontrollera passform, skick, reservdelsnummer och bilder före betalning." },
      { title: "Kom överens om villkor", text: "Skriv betalning, leverans, hämtning och returvillkor i meddelandena." },
      { title: "Undvik press", text: "Brådska, ovanliga betalningssätt och styrning utanför tjänsten är varningssignaler." }
    ],
    sections: [
      { title: "För köpare", body: ["Kontrollera säljarens profil och be vid behov om fler bilder av delen, fästpunkter, serienummer eller slitage."], bullets: ["betala inte innan uppgifterna är tydliga", "använd ett spårbart betalningssätt", "spara konversationen och kvitton", "hämta en dyr del på plats om möjligt"] },
      { title: "För säljare", body: ["Berätta produktens verkliga skick och packa en del som skickas så att den inte skadas under transporten."], bullets: ["visa fel öppet", "håll pris och tillgänglighet uppdaterade", "skicka spårningskoden till köparen", "ta bort en såld annons eller markera den som såld"] },
      { title: "Anmäl en risk", body: ["Om du märker ett bedrägeriförsök, en produkt som misstänks vara stulen eller en användare som stör andra, kontakta supporten med så noggranna uppgifter som möjligt."] }
    ],
    actions: [{ href: "mailto:info@maskines.com", label: "Anmäl problem", primary: true }],
    summaryLabel: "Trygg handel - sammanfattning"
  },
};

export default function SafetyPage() {
  return <InfoPage copy={copy} />;
}
