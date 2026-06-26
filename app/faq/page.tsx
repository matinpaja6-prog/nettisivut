import {
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
  Timer,
} from "lucide-react";
import Link from "next/link";

import { pagePath } from "@/lib/routes";

const topics = [
  {
    title: "Ostajalle",
    text: "Näin löydät osat ja teet turvallisen kaupan.",
    icon: ShoppingCart,
    tone: "orange",
  },
  {
    title: "Myyjälle",
    text: "Näin lisäät ilmoituksen ja myyt enemmän.",
    icon: Plus,
    tone: "green",
  },
  {
    title: "Turvallinen kauppa",
    text: "Näin pidämme huolen luottamuksesta.",
    icon: ShieldCheck,
    tone: "blue",
  },
  {
    title: "Yleistä",
    text: "Usein kysytyt kysymykset ja muut ohjeet.",
    icon: CircleHelp,
    tone: "amber",
  },
];

const buyerGuides = [
  { title: "Näin haet varaosia", text: "Haku merkin, mallin tai osan mukaan.", icon: Search },
  { title: "Näin otat yhteyttä myyjään", text: "Viestit, tarkennukset ja kysymykset.", icon: MessageCircle },
  { title: "Näin teet ostoksen", text: "Sopiminen, maksaminen ja toimitus.", icon: CreditCard },
  { title: "Näin seuraat tilaustasi", text: "Tilauksen vaiheet ja toimituksen seuranta.", icon: Box },
];

const sellerGuides = [
  { title: "Näin lisäät ilmoituksen", text: "Vie varaosasi loppuun asti julkaisuun.", icon: SquarePlus },
  { title: "Näin lisäät useita osia", text: "Yksi ajoneuvo, useita osia.", icon: BarChart3 },
  { title: "Näin muokkaat ilmoitusta", text: "Hinnat, tiedot ja kuvat ajan tasalle.", icon: Edit3 },
  { title: "Näin hallinnoit myyntiäsi", text: "Myydyt osat, arkistointi ja tilastot.", icon: PackageCheck },
];

const faqItems = [
  "Mitä palvelu maksaa?",
  "Onko palvelu ilmainen ostajalle?",
  "Miten ilmoituksen julkaisu toimii?",
  "Voinko lisätä useita osia yhdestä ajoneuvosta?",
  "Miten viestit ja maksut toimivat?",
];

export default function FaqPage() {
  return (
    <main className="help-page">
      <section className="help-hero">
        <div className="help-shell help-hero-inner">
          <div>
            <span className="help-kicker">Maskines ohjekeskus</span>
            <h1>Ohjeet</h1>
            <p>Kaikki ohjeet ostajalle ja myyjälle. Turvallinen kaupankäynti ja helppo ilmoittaminen.</p>
          </div>
          <form className="help-search" role="search">
            <label htmlFor="help-search">Hae ohjeista</label>
            <div>
              <Search size={17} aria-hidden="true" />
              <input id="help-search" type="search" placeholder="Hae ohjeista..." />
            </div>
            <small>Esim. "ilmoituksen lisääminen", "maksaminen"</small>
          </form>
        </div>
      </section>

      <section className="help-body">
        <div className="help-shell">
          <h2>Valitse aihe</h2>
          <div className="help-topic-grid">
            {topics.map((topic) => {
              const Icon = topic.icon;
              return (
                <Link className="help-topic-card" data-tone={topic.tone} href="#ohjeet" key={topic.title}>
                  <span className="help-topic-icon">
                    <Icon size={26} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{topic.title}</strong>
                    <small>{topic.text}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              );
            })}
          </div>

          <div className="help-columns" id="ohjeet">
            <HelpColumn title="Ostajan ohjeet" items={buyerGuides} linkLabel="Näytä kaikki ostajan ohjeet" />
            <HelpColumn title="Myyjän ohjeet" items={sellerGuides} linkLabel="Näytä kaikki myyjän ohjeet" />
            <section className="help-column">
              <h3>Usein kysytyt kysymykset</h3>
              <div className="help-faq-list">
                {faqItems.map((item) => (
                  <Link href={pagePath("contact", "fi")} key={item}>
                    <span>{item}</span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                ))}
              </div>
              <Link className="help-column-link" href={pagePath("contact", "fi")}>
                Näytä kaikki usein kysytyt kysymykset
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
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
            <div>
              <Timer size={25} aria-hidden="true" />
              <span>
                <strong>Ma-Pe 9-17</strong>
                <small>Vastaamme nopeasti</small>
              </span>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function HelpColumn({
  title,
  items,
  linkLabel,
}: {
  title: string;
  items: Array<{ title: string; text: string; icon: typeof Search }>;
  linkLabel: string;
}) {
  return (
    <section className="help-column">
      <h3>{title}</h3>
      <div className="help-guide-list">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link href={pagePath("contact", "fi")} key={item.title}>
              <Icon size={19} aria-hidden="true" />
              <span>
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          );
        })}
      </div>
      <Link className="help-column-link" href={pagePath("contact", "fi")}>
        {linkLabel}
        <ChevronRight size={15} aria-hidden="true" />
      </Link>
    </section>
  );
}
