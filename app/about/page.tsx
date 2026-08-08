"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Globe2,
  HandHeart,
  Heart,
  Headphones,
  Search,
  ShieldCheck,
  Tag,
  ThumbsUp,
  UsersRound
} from "lucide-react";

import { useLanguage } from "@/lib/i18n";
import { pagePath } from "@/lib/routes";

const featureIcons = [Search, Tag, ShieldCheck, Headphones];

const aboutCopy = {
  fi: {
    kicker: "Tietoa meistä",
    titleTop: "Varaosamaailma.",
    titleBottom: "Rakennettu",
    titleHighlight: "harrastajille.",
    intro: "Maskines kokoaa moottorikelkkojen, mönkijöiden, motocross-pyörien ja mopojen varaosat yhteen selkeään paikkaan. Tavoitteenamme on tehdä oikean osan löytämisestä nopeaa ja myymisestä vaivatonta.",
    createListing: "Luo ilmoitus",
    viewHelp: "Katso ohjeet",
    aboutMaskines: "Tietoa Maskinesista",
    why: "Miksi Maskines?",
    featuresTitle: "Tehty harrastajille, harrastajien kanssa.",
    featuresLead: "Ymmärrämme tarpeesi, koska jaamme saman intohimon.",
    features: [
      ["Oikea osa nopeasti", "Tehokas haku ja selkeät ilmoitukset auttavat löytämään juuri sen oikean osan."],
      ["Myy helpommin, myy enemmän", "Yksi ilmoitus, monta osaa. Parempi näkyvyys tuo enemmän ostajia ja parempia kauppoja."],
      ["Turvallinen kauppapaikka", "Luotettava ympäristö ja selkeät pelisäännöt suojaavat sekä ostajaa että myyjää."],
      ["Apua aina tarvittaessa", "Asiakastuki ja ohjeet ovat aina saatavilla, kun tarvitset apua eteenpäin."]
    ],
    numbersKicker: "Maskines lukuina",
    numbersTitle: "Vahva yhteisö, joka kasvaa joka päivä.",
    missionTitle: "Missiomme",
    missionText: "Haluamme olla Pohjoismaiden johtava varaosamarkkinapaikka, jossa jokainen osa löytää uuden elämän ja jokainen kauppa vie harrastusta eteenpäin.",
    communityAria: "Yhteisön lupaus",
    communityTitle: "Harrastajalta harrastajalle.",
    communityText: "Maskines tekee varaosien ostamisesta ja myymisestä selkeämpää, jotta aikaa jää sille mikä oikeasti kiinnostaa: ajamiselle, rakentamiselle ja seuraavalle projektille.",
    stats: {
      vehicleClass: ["ajoneuvoluokka ilmoituksissa", "ajoneuvoluokkaa ilmoituksissa"],
      activeListing: ["aktiivinen ilmoitus", "aktiivista ilmoitusta"],
      activeSeller: ["aktiivinen myyjä", "aktiivista myyjää"],
      registeredUser: ["rekisteröitynyt käyttäjä", "rekisteröitynyttä käyttäjää"],
      country: ["maa ilmoituksissa", "maata ilmoituksissa"]
    }
  },
  en: {
    kicker: "About us",
    titleTop: "The world of spare parts.",
    titleBottom: "Built for",
    titleHighlight: "enthusiasts.",
    intro: "Maskines brings snowmobile, ATV, motocross and moped parts together in one clear marketplace. Our goal is to make finding the right part fast and selling effortless.",
    createListing: "Create listing",
    viewHelp: "View instructions",
    aboutMaskines: "About Maskines",
    why: "Why Maskines?",
    featuresTitle: "Built for enthusiasts, together with enthusiasts.",
    featuresLead: "We understand your needs because we share the same passion.",
    features: [
      ["Find the right part fast", "Powerful search and clear listings help you find exactly the right part."],
      ["Sell more easily", "One listing, multiple parts. Better visibility brings more buyers and better deals."],
      ["A safe marketplace", "A trusted environment and clear rules protect both buyers and sellers."],
      ["Help when you need it", "Customer support and instructions are available whenever you need assistance."]
    ],
    numbersKicker: "Maskines in numbers",
    numbersTitle: "A strong community growing every day.",
    missionTitle: "Our mission",
    missionText: "We want to be the leading Nordic spare-parts marketplace, where every part finds a new life and every deal moves the hobby forward.",
    communityAria: "Community promise",
    communityTitle: "From enthusiast to enthusiast.",
    communityText: "Maskines makes buying and selling spare parts clearer, leaving more time for what really matters: riding, building and the next project.",
    stats: {
      vehicleClass: ["vehicle class in listings", "vehicle classes in listings"],
      activeListing: ["active listing", "active listings"],
      activeSeller: ["active seller", "active sellers"],
      registeredUser: ["registered user", "registered users"],
      country: ["country in listings", "countries in listings"]
    }
  },
  sv: {
    kicker: "Om oss",
    titleTop: "Reservdelsvärlden.",
    titleBottom: "Byggd för",
    titleHighlight: "entusiaster.",
    intro: "Maskines samlar reservdelar till snöskotrar, fyrhjulingar, motocrosscyklar och mopeder på en tydlig marknadsplats. Vårt mål är att göra det snabbt att hitta rätt del och enkelt att sälja.",
    createListing: "Skapa annons",
    viewHelp: "Läs instruktionerna",
    aboutMaskines: "Om Maskines",
    why: "Varför Maskines?",
    featuresTitle: "Skapad för entusiaster, tillsammans med entusiaster.",
    featuresLead: "Vi förstår dina behov eftersom vi delar samma passion.",
    features: [
      ["Hitta rätt del snabbt", "Effektiv sökning och tydliga annonser hjälper dig att hitta exakt rätt del."],
      ["Sälj enklare", "En annons, flera delar. Bättre synlighet ger fler köpare och bättre affärer."],
      ["En trygg marknadsplats", "En pålitlig miljö och tydliga regler skyddar både köpare och säljare."],
      ["Hjälp när du behöver den", "Kundsupport och instruktioner finns tillgängliga när du behöver hjälp."]
    ],
    numbersKicker: "Maskines i siffror",
    numbersTitle: "En stark gemenskap som växer varje dag.",
    missionTitle: "Vårt uppdrag",
    missionText: "Vi vill vara Nordens ledande marknadsplats för reservdelar, där varje del får ett nytt liv och varje affär för hobbyn framåt.",
    communityAria: "Gemenskapens löfte",
    communityTitle: "Från entusiast till entusiast.",
    communityText: "Maskines gör det tydligare att köpa och sälja reservdelar, så att mer tid blir över för det som verkligen betyder något: körning, byggande och nästa projekt.",
    stats: {
      vehicleClass: ["fordonsklass i annonser", "fordonsklasser i annonser"],
      activeListing: ["aktiv annons", "aktiva annonser"],
      activeSeller: ["aktiv säljare", "aktiva säljare"],
      registeredUser: ["registrerad användare", "registrerade användare"],
      country: ["land i annonser", "länder i annonser"]
    }
  },
  no: {
    kicker: "Om oss",
    titleTop: "Reservedelsverdenen.",
    titleBottom: "Bygget for",
    titleHighlight: "entusiaster.",
    intro: "Maskines samler deler til snøscootere, ATV-er, motocrossykler og mopeder på én oversiktlig markedsplass. Målet vårt er å gjøre det raskt å finne riktig del og enkelt å selge.",
    createListing: "Opprett annonse",
    viewHelp: "Se veiledningen",
    aboutMaskines: "Om Maskines",
    why: "Hvorfor Maskines?",
    featuresTitle: "Laget for entusiaster, sammen med entusiaster.",
    featuresLead: "Vi forstår behovene dine fordi vi deler den samme lidenskapen.",
    features: [
      ["Finn riktig del raskt", "Effektivt søk og tydelige annonser hjelper deg med å finne akkurat den delen du trenger."],
      ["Selg enklere", "Én annonse, flere deler. Bedre synlighet gir flere kjøpere og bedre handler."],
      ["En trygg markedsplass", "Et pålitelig miljø og tydelige regler beskytter både kjøpere og selgere."],
      ["Hjelp når du trenger det", "Kundestøtte og veiledninger er tilgjengelige når du trenger hjelp."]
    ],
    numbersKicker: "Maskines i tall",
    numbersTitle: "Et sterkt fellesskap som vokser hver dag.",
    missionTitle: "Vårt mål",
    missionText: "Vi ønsker å være Nordens ledende markedsplass for reservedeler, der hver del får et nytt liv og hver handel fører hobbyen videre.",
    communityAria: "Fellesskapets løfte",
    communityTitle: "Fra entusiast til entusiast.",
    communityText: "Maskines gjør kjøp og salg av reservedeler enklere, slik at du får mer tid til det som virkelig betyr noe: kjøring, bygging og det neste prosjektet.",
    stats: {
      vehicleClass: ["kjøretøyklasse i annonser", "kjøretøyklasser i annonser"],
      activeListing: ["aktiv annonse", "aktive annonser"],
      activeSeller: ["aktiv selger", "aktive selgere"],
      registeredUser: ["registrert bruker", "registrerte brukere"],
      country: ["land i annonser", "land i annonser"]
    }
  }
};

type AboutStats = {
  registeredUsers: number;
  activeListings: number;
  activeSellers: number;
  listingLocations: number;
  listingCountries: number;
  vehicleClasses: number;
};

function formatStatValue(value: number | null | undefined, locale: keyof typeof aboutCopy) {
  if (value === null || value === undefined) return "...";
  return value.toLocaleString(
    locale === "fi" ? "fi-FI" : locale === "sv" ? "sv-SE" : locale === "no" ? "nb-NO" : "en-US"
  );
}

function statLabel(value: number | null | undefined, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

export default function AboutPage() {
  const { locale } = useLanguage();
  const copy = aboutCopy[locale];
  const [stats, setStats] = useState<AboutStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/about-stats", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: AboutStats | null) => {
        if (!cancelled && data) {
          setStats({
            registeredUsers: Number(data.registeredUsers) || 0,
            activeListings: Number(data.activeListings) || 0,
            activeSellers: Number(data.activeSellers) || 0,
            listingLocations: Number(data.listingLocations) || 0,
            listingCountries: Number(data.listingCountries) || 0,
            vehicleClasses: Number(data.vehicleClasses) || 0
          });
        }
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const heroStats = [
    {
      icon: UsersRound,
      value: formatStatValue(stats?.vehicleClasses, locale),
      label: statLabel(stats?.vehicleClasses, copy.stats.vehicleClass[0], copy.stats.vehicleClass[1])
    },
    {
      icon: Tag,
      value: formatStatValue(stats?.activeListings, locale),
      label: statLabel(stats?.activeListings, copy.stats.activeListing[0], copy.stats.activeListing[1])
    },
    {
      icon: HandHeart,
      value: formatStatValue(stats?.activeSellers, locale),
      label: statLabel(stats?.activeSellers, copy.stats.activeSeller[0], copy.stats.activeSeller[1])
    }
  ];

  const numberStats = [
    {
      icon: UsersRound,
      value: formatStatValue(stats?.registeredUsers, locale),
      label: statLabel(stats?.registeredUsers, copy.stats.registeredUser[0], copy.stats.registeredUser[1])
    },
    {
      icon: Tag,
      value: formatStatValue(stats?.activeListings, locale),
      label: statLabel(stats?.activeListings, copy.stats.activeListing[0], copy.stats.activeListing[1])
    },
    {
      icon: Globe2,
      value: formatStatValue(stats?.listingCountries, locale),
      label: statLabel(stats?.listingCountries, copy.stats.country[0], copy.stats.country[1])
    },
    {
      icon: ThumbsUp,
      value: formatStatValue(stats?.activeSellers, locale),
      label: statLabel(stats?.activeSellers, copy.stats.activeSeller[0], copy.stats.activeSeller[1])
    }
  ];

  return (
    <main className="about-showcase-page" data-no-auto-translate>
        <section className="about-showcase-hero">
          <div className="about-showcase-copy">
            <span className="about-showcase-kicker">{copy.kicker}</span>
            <h1>
              {copy.titleTop}
              <br />
              {copy.titleBottom} <span>{copy.titleHighlight}</span>
            </h1>
            <p>{copy.intro}</p>
            <div className="about-showcase-actions">
              <Link className="about-showcase-primary" href={pagePath("sell", locale)}>
                {copy.createListing}
              </Link>
              <Link className="about-showcase-secondary" href={pagePath("faq", locale)}>
                {copy.viewHelp}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <aside className="about-showcase-stats" aria-label={copy.aboutMaskines}>
            <span>{copy.aboutMaskines}</span>
            {heroStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div className="about-showcase-stat" key={stat.label}>
                  <span className="about-showcase-stat-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <strong>{stat.value}</strong>
                  <small>{stat.label}</small>
                </div>
              );
            })}
          </aside>
        </section>

        <section className="about-showcase-features" aria-labelledby="about-features-title">
          <span className="about-showcase-section-kicker">{copy.why}</span>
          <h2 id="about-features-title">{copy.featuresTitle}</h2>
          <p>{copy.featuresLead}</p>

          <div className="about-showcase-card-grid">
            {copy.features.map(([title, text], index) => {
              const Icon = featureIcons[index];
              return (
                <article className="about-showcase-card" key={title}>
                  <span className="about-showcase-card-icon">
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="about-showcase-numbers" aria-labelledby="about-numbers-title">
          <span className="about-showcase-section-kicker">{copy.numbersKicker}</span>
          <h2 id="about-numbers-title">{copy.numbersTitle}</h2>

          <div className="about-showcase-number-grid">
            {numberStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div className="about-showcase-number" key={stat.label}>
                  <Icon size={28} aria-hidden="true" />
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              );
            })}
          </div>

          <article className="about-showcase-mission">
            <span className="about-showcase-mission-icon">
              <Heart size={28} aria-hidden="true" />
            </span>
            <div>
              <h3>{copy.missionTitle}</h3>
              <p>{copy.missionText}</p>
            </div>
          </article>
        </section>

        <section className="about-showcase-community" aria-label={copy.communityAria}>
          <HandHeart size={28} aria-hidden="true" />
          <div>
            <h2>{copy.communityTitle}</h2>
            <p>{copy.communityText}</p>
          </div>
        </section>
    </main>
  );
}
