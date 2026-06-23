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
  no: {
    kicker: "Støtte",
    title: "Trygg handel",
    lead: "Trygg reservedelshandel skapes av tydelig informasjon, rolig meldingsutveksling og at kjøper og selger avtaler ting skriftlig.",
    cards: [
      { title: "Kontroller delen", text: "Sjekk passform, tilstand, delenummer og bilder før betaling." },
      { title: "Avtal vilkår", text: "Skriv betaling, levering, henting og returmulighet i meldingene." },
      { title: "Unngå press", text: "Hastverk, uvanlige betalingsmåter og flytting utenfor tjenesten er varselsignaler." }
    ],
    sections: [
      { title: "For kjøpere", body: ["Kontroller selgerens profil og be om flere bilder av delen, festepunkter, serienummer eller slitasje ved behov."], bullets: ["ikke betal før opplysningene er tydelige", "bruk en sporbar betalingsmåte", "ta vare på samtale og kvitteringer", "hent en dyr del på stedet når det er mulig"] },
      { title: "For selgere", body: ["Fortell produktets faktiske tilstand og pakk en del som sendes slik at den ikke skades underveis."], bullets: ["vis feil åpent", "hold pris og tilgjengelighet oppdatert", "send sporingsnummer til kjøperen", "fjern en solgt annonse eller merk den som solgt"] },
      { title: "Rapporter en risiko", body: ["Hvis du oppdager et svindelforsøk, et produkt som mistenkes stjålet eller en bruker som plager andre, kontakt støtte med så detaljerte opplysninger som mulig."] }
    ],
    actions: [{ href: "mailto:info@maskines.com", label: "Rapporter problem", primary: true }],
    summaryLabel: "Trygg handel - sammendrag"
  },
  et: {
    kicker: "Tugi",
    title: "Turvaline kauplemine",
    lead: "Turvaline varuosakaubandus sünnib selgest infost, rahulikust sõnumivahetusest ja sellest, et ostja ning müüja lepivad asjad kirjalikult kokku.",
    cards: [
      { title: "Kontrolli osa", text: "Kontrolli enne maksmist sobivust, seisukorda, varuosanumbrit ja pilte." },
      { title: "Lepi tingimused kokku", text: "Pane makse, tarne, kättesaamine ja tagastusvõimalus sõnumitesse kirja." },
      { title: "Väldi survet", text: "Kiirustamine, kummalised makseviisid ja teenusest välja suunamine on ohumärgid." }
    ],
    sections: [
      { title: "Ostjale", body: ["Kontrolli müüja profiili ja küsi vajadusel lisapilte osast, kinnitustest, seerianumbrist või kulumisest."], bullets: ["ära maksa enne, kui info on selge", "kasuta jälgitavat makseviisi", "säilita vestlus ja kviitungid", "võta kallis osa võimalusel kohapealt vastu"] },
      { title: "Müüjale", body: ["Kirjelda toote tegelikku seisukorda ja paki saadetav osa nii, et see teel viga ei saaks."], bullets: ["näita vigu avatult", "hoia hind ja saadavus ajakohased", "saada ostjale jälgimiskood", "eemalda müüdud kuulutus või märgi see müüduks"] },
      { title: "Teata riskist", body: ["Kui märkad pettusekatset, varastatuks kahtlustatavat toodet või kasutajat, kes teisi häirib, võta võimalikult täpsete andmetega ühendust toega."] }
    ],
    actions: [{ href: "mailto:info@maskines.com", label: "Teata probleemist", primary: true }],
    summaryLabel: "Turvaline kauplemine - kokkuvõte"
  }
};

export default function SafetyPage() {
  return <InfoPage copy={copy} />;
}
