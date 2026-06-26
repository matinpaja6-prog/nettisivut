import InfoPage, { type InfoPageCopy } from "@/app/components/InfoPage";
import ContactForm from "@/app/contact/ContactForm";
import type { Locale } from "@/lib/i18n";
import { pagePath } from "@/lib/routes";

const fi: InfoPageCopy = {
  kicker: "Tietoa meistä",
  title: "Varaosamarkkina rakennettu harrastajille.",
  lead: "Maskines kokoaa moottorikelkkojen, mönkijöiden, motocross-pyörien ja mopojen varaosat yhteen selkeään paikkaan. Tavoitteena on tehdä oikean osan löytämisestä nopeaa ja myymisestä vaivatonta.",
  visualLabel: "Pohjoisen ajoneuvoihin keskittynyt varaosapalvelu",
  stats: [
    { value: "4", label: "ajoneuvoluokkaa" },
    { value: "2 min", label: "nopea ilmoitus" },
    { value: "24/7", label: "haku auki ostajille" }
  ],
  cards: [
    {
      title: "Osat löytyvät ajoneuvon mukaan",
      text: "Ostaja voi rajata hakua ajoneuvotyypin, merkin, mallin, vuosimallin ja kategorian mukaan. Se vähentää turhaa kyselyä ja nopeuttaa kauppaa."
    },
    {
      title: "Myyjälle vähemmän säätöä",
      text: "Ilmoituksen tekeminen ohjaa täyttämään oleelliset tiedot: kunto, sopivuus, sijainti, kuvat ja hinta. Hyvä osa pääsee näkyviin ilman monen kanavan rumbaa."
    },
    {
      title: "Rakennettu pohjoisen käyttöön",
      text: "Palvelun ydin on ajoneuvoissa, joissa oikea varaosa voi pelastaa ajokauden: kelkat, mönkijät, motocross ja mopot."
    }
  ],
  sections: [
    {
      title: "Miksi Maskines on olemassa?",
      body: [
        "Varaosakauppa on usein hajallaan some-ryhmissä, viesteissä ja vanhoissa ilmoituskanavissa. Ostaja ei tiedä löytyykö osa, myyjä vastaa samoihin kysymyksiin uudelleen ja hyvät osat jäävät helposti varaston perälle.",
        "Maskines tuo osat samaan paikkaan ja tekee ilmoituksista vertailukelpoisia. Kun tieto on selkeää, yhteydenotto on parempi ja kauppa syntyy nopeammin."
      ]
    },
    {
      title: "Kenelle palvelu on tehty?",
      body: [
        "Maskines palvelee harrastajia, yksityisiä myyjiä, purkuosien myyjiä ja yrityksiä. Palvelu sopii sekä yksittäiselle osalle että laajemmalle varastolle."
      ],
      bullets: [
        "moottorikelkan osat ja tarvikkeet",
        "mönkijän varaosat",
        "motocross- ja enduro-osat",
        "mopojen osat, katteet ja tekniikka"
      ]
    },
    {
      title: "Miten pidämme laadun hyvänä?",
      body: [
        "Kannustamme selkeisiin kuviin, rehelliseen kuntokuvaukseen ja yhteensopivuustietoihin. Epäselvä tai harhaanjohtava sisältö voidaan poistaa, jotta ostajien luottamus säilyy.",
        "Kehitämme palvelua palautteen perusteella. Tärkeintä on, että ostaminen ja myyminen tuntuu nopealta myös puhelimella."
      ]
    }
  ],
  actions: [
    { href: pagePath("sell", "fi"), label: "Luo ilmoitus", primary: true },
    { href: pagePath("faq", "fi"), label: "Katso ohjeet" }
  ],
  summaryLabel: "Maskines lyhyesti"
};

const en: InfoPageCopy = {
  ...fi,
  kicker: "About us",
  title: "A parts marketplace built for riders.",
  lead: "Maskines brings snowmobile, ATV, motocross and moped parts into one focused marketplace so the right part is easier to find and easier to sell.",
  visualLabel: "A marketplace focused on northern vehicles",
  actions: [
    { href: pagePath("sell", "en"), label: "Create listing", primary: true },
    { href: pagePath("faq", "en"), label: "Read help" }
  ]
};

const copy: Record<Locale, InfoPageCopy> = {
  fi,
  en,
  sv: { ...en, kicker: "Om oss", title: "En reservdelsmarknad byggd för förare.", actions: [{ href: pagePath("sell", "sv"), label: "Skapa annons", primary: true }, { href: pagePath("faq", "sv"), label: "Läs hjälp" }] },
  no: { ...en, kicker: "Om oss", title: "En delemarkedsplass laget for førere.", actions: [{ href: pagePath("sell", "no"), label: "Opprett annonse", primary: true }, { href: pagePath("faq", "no"), label: "Les hjelp" }] },
  et: { ...en, kicker: "Meist", title: "Varuosaturg sõitjatele.", actions: [{ href: pagePath("sell", "et"), label: "Lisa kuulutus", primary: true }, { href: pagePath("faq", "et"), label: "Vaata abi" }] }
};

export default function AboutPage() {
  return (
    <>
      <InfoPage copy={copy} />
      <ContactForm embedded />
    </>
  );
}
