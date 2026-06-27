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
    text: "Näin löydät osat ja teet turvallisen kaupan.",
    icon: ShoppingCart,
    tone: "orange"
  },
  {
    id: "seller",
    title: "Myyjälle",
    text: "Näin lisäät ilmoituksen ja myyt enemmän.",
    icon: Plus,
    tone: "green"
  },
  {
    id: "safety",
    title: "Turvallinen kauppa",
    text: "Näin pidämme huolen turvallisuudesta.",
    icon: ShieldCheck,
    tone: "blue"
  },
  {
    id: "general",
    title: "Yleistä",
    text: "Usein kysytyt kysymykset ja muut ohjeet.",
    icon: CircleHelp,
    tone: "amber"
  }
];

const buyerGuides: HelpItem[] = [
  {
    id: "find-parts",
    topic: "buyer",
    title: "Näin haet varaosia",
    text: "Hae merkin, mallin tai osan mukaan.",
    icon: Search,
    answer: [
      "Kirjoita hakukenttään osan nimi, ajoneuvon merkki, malli tai vuosimalli.",
      "Rajaa tuloksia ajoneuvotyypin, kategorian, hinnan ja sijainnin mukaan.",
      "Avaa ilmoitus ja tarkista kuvat, osanumero, kunto sekä myyjän tiedot ennen yhteydenottoa."
    ]
  },
  {
    id: "contact-seller",
    topic: "buyer",
    title: "Näin otat yhteyttä myyjään",
    text: "Viestit, tarkennukset ja kysymykset.",
    icon: MessageCircle,
    answer: [
      "Kysy myyjältä sopiiko osa varmasti omaan ajoneuvoosi.",
      "Pyydä lisäkuvia, osanumero tai mitat, jos ilmoituksessa ei ole kaikkea tietoa.",
      "Pidä keskustelu Maskines-viesteissä, jotta sovitut asiat jäävät talteen."
    ]
  },
  {
    id: "buy-safely",
    topic: "buyer",
    title: "Näin teet ostoksen",
    text: "Sopiminen, maksaminen ja toimitus.",
    icon: CreditCard,
    answer: [
      "Sovi hinta, toimitustapa ja maksutapa selkeästi ennen maksamista.",
      "Suosi noutoa tai seurattavaa lähetystä, kun osa on arvokas tai vaikeasti korvattava.",
      "Maskines ei käsittele ostajan ja myyjän välistä maksua, joten käytä tuttua ja turvallista maksutapaa."
    ]
  },
  {
    id: "track-order",
    topic: "buyer",
    title: "Näin seuraat tilaustasi",
    text: "Tilauksen vaiheet ja toimituksen seuranta.",
    icon: Box,
    answer: [
      "Pyydä myyjältä seurantakoodi heti kun lähetys on jätetty kuljetukseen.",
      "Tarkista paketti vastaanottaessa ja kuvaa mahdolliset kuljetusvauriot heti.",
      "Jos toimitus viivästyy, ota ensin yhteys myyjään ja sen jälkeen kuljetusyhtiöön."
    ]
  }
];

const sellerGuides: HelpItem[] = [
  {
    id: "create-listing",
    topic: "seller",
    title: "Näin lisäät ilmoituksen",
    text: "Vie varaosasi loppuun asti julkaisuun.",
    icon: SquarePlus,
    answer: [
      "Valitse oikea ajoneuvotyyppi, merkki, malli ja varaosan kategoria.",
      "Lisää selkeät kuvat, hinta, kunto, sijainti ja mahdollinen osanumero.",
      "Tarkista ilmoitus ennen julkaisua. Mitä tarkempi ilmoitus on, sitä vähemmän tulee turhia kysymyksiä."
    ]
  },
  {
    id: "many-parts",
    topic: "seller",
    title: "Näin lisäät useita osia",
    text: "Yksi ajoneuvo, useita osia.",
    icon: BarChart3,
    answer: [
      "Käytä samaa ajoneuvon merkki- ja mallitietoa, jos myyt useita osia samasta kohteesta.",
      "Nimeä jokainen osa erikseen ja lisää sille oma hinta sekä kunto.",
      "Pidä kuvat järjestyksessä: ostaja näkee nopeammin, mikä osa on kyseessä."
    ]
  },
  {
    id: "edit-listing",
    topic: "seller",
    title: "Näin muokkaat ilmoitusta",
    text: "Hinnat, tiedot ja kuvat ajan tasalle.",
    icon: Edit3,
    answer: [
      "Avaa omat ilmoitukset ja valitse muokattava ilmoitus.",
      "Päivitä hinta, saatavuus, kuvat tai lisätiedot aina kun tilanne muuttuu.",
      "Poista tai merkitse myydyksi osa, jota ei ole enää saatavilla."
    ]
  },
  {
    id: "manage-sales",
    topic: "seller",
    title: "Näin hallinnoit myyntiäsi",
    text: "Myydyt osat, arkistointi ja tilastot.",
    icon: PackageCheck,
    answer: [
      "Seuraa yhteydenottoja viesteistä ja vastaa ostajille mahdollisimman nopeasti.",
      "Pidä profiilin tiedot ajan tasalla, jotta ostaja luottaa myyjään.",
      "Arkistoi vanhat ilmoitukset ja käytä samoja hyviä kuvia sekä kuvauksia tulevissa myynneissä."
    ]
  }
];

const safetyGuides: HelpItem[] = [
  {
    id: "safe-payment",
    topic: "safety",
    title: "Turvallinen maksaminen",
    text: "Vältä riskit ennen kuin lähetät rahaa.",
    icon: ShieldCheck,
    answer: [
      "Älä lähetä rahaa, jos ilmoitus, kuvat tai myyjän vastaukset tuntuvat ristiriitaisilta.",
      "Varmista myyjän nimi, paikkakunta ja toimitustapa ennen maksua.",
      "Kalliissa osissa nouto tai maksutapa, jossa on ostajansuoja, on turvallisempi valinta."
    ]
  },
  {
    id: "suspicious-listing",
    topic: "safety",
    title: "Epäilyttävä ilmoitus",
    text: "Mitä tehdä, jos jokin ei täsmää.",
    icon: AlertTriangle,
    answer: [
      "Älä jatka kauppaa, jos myyjä painostaa nopeaan maksuun tai siirtää keskustelun epäilyttävään kanavaan.",
      "Ota kuvakaappaukset viesteistä ja ilmoituksesta.",
      "Ilmoita asiasta Maskinesin tuelle, jotta voimme tarkistaa ilmoituksen."
    ]
  }
];

const allGuides = [...buyerGuides, ...sellerGuides, ...safetyGuides];

const faqItems: FaqItem[] = [
  {
    id: "cost",
    topic: "general",
    question: "Mitä palvelu maksaa?",
    answer:
      "Ostajalle selaaminen ja yhteydenotto on ilmaista. Myyjälle tavallinen ilmoituksen lisääminen on pidetty mahdollisimman kevyenä; jos palveluun tulee maksullisia lisänäkyvyyksiä, hinta näytetään aina ennen ostoa."
  },
  {
    id: "buyer-free",
    topic: "buyer",
    question: "Onko palvelu ilmainen ostajalle?",
    answer:
      "Kyllä. Ostaja voi hakea varaosia, selata ilmoituksia ja ottaa yhteyttä myyjään ilman maksua."
  },
  {
    id: "publish",
    topic: "seller",
    question: "Miten ilmoituksen julkaisu toimii?",
    answer:
      "Kirjaudu sisään, valitse Myy osa, täytä ajoneuvon ja varaosan tiedot, lisää kuvat ja julkaise ilmoitus. Ilmoitus näkyy hakutuloksissa, kun tiedot on tallennettu onnistuneesti."
  },
  {
    id: "multi-parts",
    topic: "seller",
    question: "Voinko lisätä useita osia yhdestä ajoneuvosta?",
    answer:
      "Kyllä. Voit tehdä useita ilmoituksia samalle ajoneuvolle ja käyttää samoja merkki-, malli- ja vuosimallitietoja, jotta ostaja löytää osat helpommin."
  },
  {
    id: "messages-payments",
    topic: "safety",
    question: "Miten viestit ja maksut toimivat?",
    answer:
      "Viestit kulkevat Maskinesin kautta. Maksu, nouto ja toimitus sovitaan ostajan ja myyjän välillä. Suosittelemme selkeää sopimusta, seurattavaa toimitusta ja turvallista maksutapaa."
  },
  {
    id: "bad-part",
    topic: "buyer",
    question: "Mitä teen, jos osa ei vastaa sovittua?",
    answer:
      "Ota heti yhteyttä myyjään ja kerro ongelma selkeästi kuvien kanssa. Jos asia ei ratkea, ota yhteyttä tukeen ja liitä mukaan ilmoituksen linkki sekä viestikeskustelu."
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
            <p>Kaikki ohjeet ostajalle ja myyjälle. Turvallinen kaupankäynti ja helppo ilmoittaminen.</p>
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
                <small>Asiakastukemme auttaa mielellään.</small>
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
