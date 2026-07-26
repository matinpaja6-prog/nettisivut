"use client";

import {
  AlertTriangle,
  BarChart3,
  Box,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Edit3,
  Headphones,
  Mail,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  SquarePlus,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { pagePath } from "@/lib/routes";

type TopicId = "buyer" | "seller" | "safety" | "general";

type HelpItem = {
  id: string;
  topic: TopicId;
  title: string;
  text: string;
  icon: LucideIcon;
  answer: string[];
};

type FaqItem = {
  id: string;
  topic: TopicId;
  question: string;
  answer: string;
};

const topics: Array<{
  id: TopicId;
  title: string;
  text: string;
  icon: LucideIcon;
  tone: "orange" | "green" | "blue" | "amber";
}> = [
  {
    id: "buyer",
    title: "Ostajalle",
    text: "Löydä oikea osa ja varmista sopivuus ennen kauppaa.",
    icon: ShoppingCart,
    tone: "orange"
  },
  {
    id: "seller",
    title: "Myyjälle",
    text: "Tee ilmoitus, johon ostajan on helppo tarttua.",
    icon: Plus,
    tone: "green"
  },
  {
    id: "safety",
    title: "Turvallinen kauppa",
    text: "Tunnista riskit ja sovi kaupasta selkeästi.",
    icon: ShieldCheck,
    tone: "blue"
  },
  {
    id: "general",
    title: "Yleistä",
    text: "Nopeat vastaukset Maskinesin käyttöön.",
    icon: CircleHelp,
    tone: "amber"
  }
];

const buyerGuides: HelpItem[] = [
  {
    id: "find-parts",
    topic: "buyer",
    title: "Löydä oikea varaosa",
    text: "Rajaa haku ajoneuvon ja osan mukaan.",
    icon: Search,
    answer: [
      "Aloita ajoneuvolajista ja rajaa haku tyypin, merkin, mallin sekä vuosimallin mukaan.",
      "Hae osan nimellä tai OEM-numerolla. Esimerkiksi \"Ski-Doo 850 variaattori\" antaa tarkemmat tulokset kuin pelkkä \"variaattori\".",
      "Tarkista ilmoituksesta kunto, osanumero, mitat ja sijainti. Pelkkä saman näköinen osa ei aina tarkoita, että se sopii."
    ]
  },
  {
    id: "contact-seller",
    topic: "buyer",
    title: "Varmista osan sopivuus",
    text: "Kysy nämä ennen kuin sovit kaupasta.",
    icon: MessageCircle,
    answer: [
      "Kerro myyjälle oman ajoneuvosi tarkka merkki, malli, vuosimalli ja tarvittaessa moottoriversio.",
      "Vertaa OEM-numeroa, kiinnityspisteitä ja mittoja. Pyydä lähikuvat liittimistä, kierteistä ja kuluvista pinnoista.",
      "Kysy suoraan vioista, korjauksista ja siitä, mistä ajoneuvosta osa on irrotettu. Tallenna sovitut asiat Maskines-viesteihin."
    ]
  },
  {
    id: "buy-safely",
    topic: "buyer",
    title: "Sovi kauppa selkeästi",
    text: "Hinta, maksu ja toimitus ilman arvailua.",
    icon: CreditCard,
    answer: [
      "Vahvista ennen maksua, mitä kauppaan kuuluu: tarkka osa, mahdolliset tarvikkeet, kokonaishinta ja toimituskulut.",
      "Arvokas tai vaikeasti tunnistettava osa kannattaa tarkistaa noudettaessa. Lähetykselle kannattaa pyytää seuranta ja riittävä pakkaus.",
      "Maskines ei vastaanota eikä välitä kauppasummaa. Ostaja ja myyjä sopivat maksutavan itse, joten valitse tapa, jonka ehdot tunnet."
    ]
  },
  {
    id: "track-order",
    topic: "buyer",
    title: "Kun osa lähetetään",
    text: "Seuranta, vastaanotto ja tarkastus.",
    icon: Box,
    answer: [
      "Pyydä myyjää lähettämään seurantakoodi ja kuva valmiiksi pakatusta lähetyksestä.",
      "Tarkista paketin kunto heti vastaanottaessa. Kuvaa vaurioitunut pakkaus ennen avaamista ja kuvaa myös osa.",
      "Jos lähetys ei liiku tai sisältö poikkeaa sovitusta, ota ensin yhteys myyjään ja tarvittaessa kuljetusyhtiöön."
    ]
  }
];

const sellerGuides: HelpItem[] = [
  {
    id: "create-listing",
    topic: "seller",
    title: "Tee löydettävä ilmoitus",
    text: "Oikea ajoneuvo, osa ja otsikko.",
    icon: SquarePlus,
    answer: [
      "Valitse ajoneuvolaji, tyyppi, merkki, malli ja osakategoria mahdollisimman tarkasti. Näitä tietoja käytetään haun rajauksissa.",
      "Kirjoita otsikkoon osa ja tärkein sopivuustieto, esimerkiksi \"KTM 125 EXC 2020 takaiskari\".",
      "Lisää realistinen hinta, sijainti, kunto, OEM-numero ja tiedossa olevat yhteensopivat vuosimallit."
    ]
  },
  {
    id: "many-parts",
    topic: "seller",
    title: "Kuvat ja kuntotiedot",
    text: "Näytä ostajalle myös käytön jäljet.",
    icon: BarChart3,
    answer: [
      "Kuvaa osa päivänvalossa useasta suunnasta. Ensimmäisen kuvan pitää näyttää myytävä osa kokonaan.",
      "Lisää lähikuva osanumerosta, liittimistä, kiinnityksistä ja kulumista. Älä rajaa vikaa kuvan ulkopuolelle.",
      "Kerro kuvauksessa rehellisesti halkeamat, välykset, hitsaukset, puuttuvat osat ja se, onko toimintaa testattu."
    ]
  },
  {
    id: "edit-listing",
    topic: "seller",
    title: "Myy useita osia",
    text: "Pidä jokainen osa ja hinta selkeänä.",
    icon: Edit3,
    answer: [
      "Käytä usean ilmoituksen toimintoa, kun purat samasta ajoneuvosta monta erikseen myytävää osaa.",
      "Anna jokaiselle osalle oma nimi, hinta, kunto ja sitä vastaavat kuvat. Älä niputa eri osien tietoja yhteen.",
      "Samat ajoneuvotiedot voidaan hyödyntää kaikissa erän ilmoituksissa, mutta tarkista jokainen osa ennen julkaisua."
    ]
  },
  {
    id: "manage-sales",
    topic: "seller",
    title: "Pidä myynti ajan tasalla",
    text: "Vastaa, päivitä ja merkitse myydyksi.",
    icon: PackageCheck,
    answer: [
      "Vastaa sopivuus- ja kuntokysymyksiin samoilla tiedoilla, jotka pystyt myös näyttämään kuvista tai osanumerosta.",
      "Päivitä hintaa, kuvia ja kuvausta, jos saat ilmoituksen jälkeen uutta tietoa osasta.",
      "Merkitse osa myydyksi heti kaupan valmistuttua. Näin ostajat eivät kysy tuotteesta, jota ei enää ole."
    ]
  }
];

const safetyGuides: HelpItem[] = [
  {
    id: "safe-payment",
    topic: "safety",
    title: "Tarkista ennen maksua",
    text: "Pieni tarkistus voi estää ison vahingon.",
    icon: ShieldCheck,
    answer: [
      "Vertaa ilmoituksen kuvia, kuvausta, hintaa ja myyjän vastauksia. Selvästi markkinahintaa halvempi osa vaatii tavallista tarkemman selvityksen.",
      "Varmista myyjän nimi, puhelinnumero, paikkakunta ja se, että hän pystyy ottamaan pyydetyn lisäkuvan osasta.",
      "Älä maksa kiireen tai painostuksen vuoksi. Kalliissa kaupassa nouto tai ostajansuojaa tarjoava maksutapa pienentää riskiä."
    ]
  },
  {
    id: "suspicious-listing",
    topic: "safety",
    title: "Tunnista epäilyttävä toiminta",
    text: "Keskeytä kauppa, jos tiedot eivät täsmää.",
    icon: AlertTriangle,
    answer: [
      "Varoitusmerkkejä ovat kopioidut kuvat, epäselvä omistajuus, vaihtuvat maksutiedot ja kieltäytyminen lisäkuvista tai noudosta.",
      "Keskeytä maksaminen ja säilytä ilmoituksen linkki, viestit, maksutiedot sekä kuvakaappaukset.",
      "Lähetä tiedot Maskinesin tukeen. Voimme tarkistaa käyttäjän ja ilmoituksen, mutta emme ratkaise osapuolten välistä maksuriitaa."
    ]
  }
];

const allGuides = [...buyerGuides, ...sellerGuides, ...safetyGuides];

const faqItems: FaqItem[] = [
  {
    id: "cost",
    topic: "general",
    question: "Maksaako Maskinesin käyttäminen?",
    answer:
      "Ilmoitusten selaaminen ja puhelinnumeron katsominen on maksutonta. Viestien lähettäminen ja omien ilmoitusten hallinta vaatii kirjautumisen. Mahdollisen maksullisen lisänäkyvyyden tai ilmoituspaikan hinta näytetään aina ennen vahvistamista."
  },
  {
    id: "buyer-free",
    topic: "buyer",
    question: "Miten varmistan, että osa sopii ajoneuvooni?",
    answer:
      "Vertaa OEM-numeroa, ajoneuvon tarkkaa mallia ja vuosimallia sekä osan mittoja ja liitäntöjä. Lähetä myyjälle tarvittaessa kuva vanhasta osasta. Lopullinen sopivuus kannattaa varmistaa ennen maksua, sillä saman mallisarjan osissa voi olla vuosimallikohtaisia eroja."
  },
  {
    id: "publish",
    topic: "seller",
    question: "Mitä hyvässä ilmoituksessa pitää olla?",
    answer:
      "Hyvä ilmoitus sisältää oikean ajoneuvo- ja osakategorian, selkeän otsikon, aidot kuvat, hinnan, sijainnin, kunnon, OEM-numeron sekä kaikki tiedossa olevat viat. Kerro myös, mistä ajoneuvosta osa on irrotettu ja onko sen toiminta testattu."
  },
  {
    id: "multi-parts",
    topic: "seller",
    question: "Voinko ilmoittaa monta osaa samasta ajoneuvosta?",
    answer:
      "Kyllä. Valitse usean ilmoituksen toiminto, lisää yhteiset ajoneuvotiedot kerran ja täytä jokaiselle osalle oma hinta, kunto, kuvaus ja kuvat. Näin jokainen osa löytyy hausta erillisenä ilmoituksena."
  },
  {
    id: "messages-payments",
    topic: "safety",
    question: "Kulkeeko maksu Maskinesin kautta?",
    answer:
      "Ei. Maskines toimii ilmoitus- ja yhteydenottopalveluna, eikä säilytä tai välitä kauppasummaa. Ostaja ja myyjä sopivat maksun, noudon ja toimituksen keskenään. Käytä maksutapaa, jonka ehdot ja mahdollisen ostajansuojan tunnet."
  },
  {
    id: "bad-part",
    topic: "buyer",
    question: "Mitä teen, jos osa ei vastaa sovittua?",
    answer:
      "Älä asenna tai muokkaa osaa ennen asian selvittämistä. Kuvaa pakkaus, osa, osanumero ja havaittu ero. Ota heti yhteys myyjään Maskines-viestillä ja ehdota ratkaisua. Jos asia ei ratkea, lähetä tuelle ilmoituksen linkki, kuvat ja viestihistoria."
  },
  {
    id: "seller-response",
    topic: "buyer",
    question: "Mitä teen, jos myyjä ei vastaa?",
    answer:
      "Anna myyjälle kohtuullinen aika vastata ja kokeile ilmoituksessa näkyvää puhelinnumeroa. Älä lähetä maksua ennen kuin osan saatavuus, sopivuus ja kaupan ehdot on vahvistettu. Jos ilmoitus vaikuttaa vanhentuneelta tai epäilyttävältä, ilmoita siitä tuelle."
  },
  {
    id: "edit-or-sold",
    topic: "seller",
    question: "Miten muokkaan tai poistan ilmoituksen?",
    answer:
      "Avaa Oma talli tai Omat ilmoitukset, valitse kyseinen ilmoitus ja avaa muokkaus. Päivitä muuttuneet tiedot heti. Kun osa on myyty, merkitse se myydyksi tai poista ilmoitus, jotta ostajat eivät ota turhaan yhteyttä."
  },
  {
    id: "report-listing",
    topic: "safety",
    question: "Miten ilmoitan epäilyttävästä ilmoituksesta?",
    answer:
      "Keskeytä kaupanteko ja ota talteen ilmoituksen linkki sekä olennaiset viestit. Lähetä ne Maskinesin yhteydenottosivun kautta tai osoitteeseen info@maskines.com. Kerro lyhyesti, mikä ilmoituksessa tai yhteydenpidossa herätti epäilyn."
  }
];

export default function FaqPage() {
  const [activeTopic, setActiveTopic] = useState<TopicId>("buyer");

  const visibleFaqs = useMemo(() => {
    return faqItems.filter((item) => {
      return activeTopic === "general" ? true : item.topic === activeTopic || item.topic === "general";
    });
  }, [activeTopic]);

  function chooseTopic(topic: TopicId) {
    setActiveTopic(topic);
    document.getElementById("ohjeet")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="help-page">
      <section className="help-hero">
        <div className="help-shell help-hero-inner">
          <div>
            <span className="help-kicker">Maskines ohjekeskus</span>
            <h1>Ohjeet</h1>
            <p>Käytännön ohjeet varaosan löytämiseen, myymiseen ja turvalliseen kaupankäyntiin.</p>
          </div>
        </div>
      </section>

      <section className="help-body">
        <div className="help-shell">
          <h2>Valitse aihe</h2>
          <div className="help-topic-grid">
            {topics.map((topic) => {
              const Icon = topic.icon;
              const selected = activeTopic === topic.id;

              return (
                <button
                  className="help-topic-card"
                  data-active={selected ? "true" : "false"}
                  data-topic={topic.id}
                  data-tone={topic.tone}
                  key={topic.id}
                  type="button"
                  onClick={() => chooseTopic(topic.id)}
                >
                  <span className="help-topic-icon">
                    <Icon size={26} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{topic.title}</strong>
                    <small>{topic.text}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div className="help-columns" id="ohjeet">
            <HelpColumn
              title="Ostajan ohjeet"
              items={buyerGuides}
            />
            <HelpColumn
              title="Myyjän ohjeet"
              items={sellerGuides}
            />
            <section className="help-column">
              <h3>Usein kysytyt kysymykset</h3>
              <div className="help-faq-list">
                {visibleFaqs.map((item) => {
                  return (
                    <details className="help-faq-item" key={item.id}>
                      <summary data-faq-id={item.id}>
                        <span>{item.question}</span>
                        <ChevronRight size={17} aria-hidden="true" />
                      </summary>
                      <p>{item.answer}</p>
                    </details>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="help-support">
            <div className="help-support-main">
              <span>
                <Headphones size={28} aria-hidden="true" />
              </span>
              <div>
                <strong>Tarvitsetko apua?</strong>
                <small>Kerro ilmoituksen linkki ja mitä olit tekemässä, niin pääsemme nopeammin asiaan.</small>
              </div>
            </div>
            <Link href={pagePath("contact", "fi")}>
              <MessageCircle size={25} aria-hidden="true" />
              <span>
                <strong>Ota yhteyttä</strong>
                <small>Lähetä viesti</small>
              </span>
            </Link>
            <a href="mailto:info@maskines.com">
              <Mail size={25} aria-hidden="true" />
              <span>
                <strong>Sähköposti</strong>
                <small>info@maskines.com</small>
              </span>
            </a>
          </section>
        </div>
      </section>
    </main>
  );
}

function HelpColumn({
  title,
  items
}: {
  title: string;
  items: HelpItem[];
}) {
  return (
    <section className="help-column">
      <h3>{title}</h3>
      <div className="help-guide-list">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <details className="help-guide-entry" key={item.title}>
              <summary
                className="help-guide-item"
              >
                <Icon size={19} aria-hidden="true" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.text}</small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </summary>
              <ol className="help-guide-answer">
                {item.answer.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </details>
          );
        })}
      </div>
    </section>
  );
}
