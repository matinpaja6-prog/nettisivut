"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useLanguage } from "@/lib/i18n";

const aboutCopy = {
  fi: {
    kicker: "Meistä",
    titleTop: "Harrastuksesta syntynyt.",
    titleHighlight: "Yhteisölle rakennettu.",
    intro: "Maskines yhdistää varaosat, ajoneuvot, ajovarusteet ja ihmiset yhdessä selkeässä pohjoismaisessa markkinapaikassa.",
    marketplaceKicker: "Markkinapaikka",
    marketplaceTitle: "Kaikki harrastukseen. Yhdestä paikasta.",
    searchPlaceholder: "Hae varaosia tai ajoneuvoja",
    searchCta: "Hae",
    categories: ["Varaosat", "Ajoneuvot", "Ajovarusteet"],
    marketplaceActions: "Osta · Myy · Löydä",
    storyTitle: "Meidän tarinamme",
    story: [
      "Maskines perustettiin toukokuussa 2026 harrastajien tarpeesta tehdä varaosien, ajoneuvojen ja ajovarusteiden kaupasta helpompaa.",
      "Rakennamme palvelua yhdessä käyttäjien, myyjien ja alan yritysten kanssa. Tavoitteena on markkinapaikka, jossa oikea tuote löytyy nopeasti ja kaupankäynti tuntuu selkeältä alusta loppuun."
    ],
    whyTitle: "Miksi Maskines?",
    features: [
      ["Oikea osa nopeammin", "Älykäs haku ja tarkat suodattimet auttavat löytämään oikean tuotteen ilman turhaa selaamista."],
      ["Turvallinen kauppapaikka", "Selkeät ilmoitukset, myyjäprofiilit ja yhteiset pelisäännöt tukevat luotettavaa kaupankäyntiä."],
      ["Pohjoismainen yhteisö", "Maskines kokoaa harrastajat, yksityiset myyjät ja alan yritykset samaan palveluun."],
      ["Harrastajalta harrastajalle", "Palvelua kehitetään käytännön tarpeisiin, jotta aikaa jää ajamiseen, rakentamiseen ja seuraavaan projektiin."]
    ],
    numbersTitle: "Maskines juuri nyt",
    quote: "Rakennamme Maskinesia joka päivä käyttäjiemme kanssa — selkeämmäksi, turvallisemmaksi ja hyödyllisemmäksi koko harrastajayhteisölle.",
    quoteBy: "Maskinesin lupaus",
    faqTitle: "Usein kysyttyä",
    faqs: [
      ["Mitä Maskinesissa voi tehdä?", "Maskinesissa voit ostaa ja myydä varaosia, ajoneuvoja ja ajovarusteita sekä löytää harrastajia ja alan yrityksiä eri puolilta Pohjoismaita."],
      ["Mitä Maskinesissa voi myydä?", "Voit myydä varaosia, kokonaisia ajoneuvoja ja ajovarusteita."]
    ],
    ctaTitle: "Löydä seuraava osa jo tänään.",
    ctaButton: "Tutustu ilmoituksiin",
    stats: {
      registeredUser: ["rekisteröitynyt käyttäjä", "rekisteröitynyttä käyttäjää"],
      activeListing: ["aktiivinen ilmoitus", "aktiivista ilmoitusta"],
      country: ["maa ilmoituksissa", "maata ilmoituksissa"],
      activeSeller: ["aktiivinen myyjä", "aktiivista myyjää"]
    }
  },
  en: {
    kicker: "About us",
    titleTop: "Born from the hobby.",
    titleHighlight: "Built for the community.",
    intro: "Maskines connects spare parts, vehicles, riding gear and people in one clear Nordic marketplace.",
    marketplaceKicker: "Marketplace",
    marketplaceTitle: "Everything for the hobby. In one place.",
    searchPlaceholder: "Search parts or vehicles",
    searchCta: "Search",
    categories: ["Spare parts", "Vehicles", "Riding gear"],
    marketplaceActions: "Buy · Sell · Find",
    storyTitle: "Our story",
    story: [
      "Maskines was founded in May 2026 from enthusiasts' need to make trading spare parts, vehicles and riding gear easier.",
      "We build the service together with users, sellers and businesses in the industry. Our goal is a marketplace where the right product is found quickly and trading feels clear from start to finish."
    ],
    whyTitle: "Why Maskines?",
    features: [
      ["Find the right part faster", "Smart search and precise filters help you find the right product without unnecessary browsing."],
      ["A safer marketplace", "Clear listings, seller profiles and shared rules support trusted trading."],
      ["A Nordic community", "Maskines brings enthusiasts, private sellers and industry businesses into one service."],
      ["From enthusiast to enthusiast", "The service is built around practical needs, leaving more time for riding, building and the next project."]
    ],
    numbersTitle: "Maskines right now",
    quote: "We build Maskines every day together with our users — clearer, safer and more useful for the whole enthusiast community.",
    quoteBy: "The Maskines promise",
    faqTitle: "Frequently asked questions",
    faqs: [
      ["What can I do on Maskines?", "You can buy and sell spare parts, vehicles and riding gear, and find enthusiasts and businesses around the Nordics."],
      ["What can I sell on Maskines?", "You can sell spare parts, complete vehicles and riding gear."]
    ],
    ctaTitle: "Find your next part today.",
    ctaButton: "Browse listings",
    stats: {
      registeredUser: ["registered user", "registered users"],
      activeListing: ["active listing", "active listings"],
      country: ["country in listings", "countries in listings"],
      activeSeller: ["active seller", "active sellers"]
    }
  },
  sv: {
    kicker: "Om oss",
    titleTop: "Född ur hobbyn.",
    titleHighlight: "Byggd för gemenskapen.",
    intro: "Maskines förenar reservdelar, fordon, körutrustning och människor på en tydlig nordisk marknadsplats.",
    marketplaceKicker: "Marknadsplats",
    marketplaceTitle: "Allt för hobbyn. På ett ställe.",
    searchPlaceholder: "Sök reservdelar eller fordon",
    searchCta: "Sök",
    categories: ["Reservdelar", "Fordon", "Körutrustning"],
    marketplaceActions: "Köp · Sälj · Hitta",
    storyTitle: "Vår berättelse",
    story: [
      "Maskines grundades i maj 2026 ur entusiasters behov av enklare handel med reservdelar, fordon och körutrustning.",
      "Vi bygger tjänsten tillsammans med användare, säljare och företag i branschen. Målet är en marknadsplats där rätt produkt hittas snabbt och handeln känns tydlig från början till slut."
    ],
    whyTitle: "Varför Maskines?",
    features: [
      ["Hitta rätt del snabbare", "Smart sökning och exakta filter hjälper dig att hitta rätt produkt utan onödig bläddring."],
      ["En tryggare marknadsplats", "Tydliga annonser, säljarprofiler och gemensamma regler stöder pålitlig handel."],
      ["En nordisk gemenskap", "Maskines samlar entusiaster, privata säljare och branschföretag i samma tjänst."],
      ["Från entusiast till entusiast", "Tjänsten utvecklas för verkliga behov, så att mer tid blir över för körning, byggande och nästa projekt."]
    ],
    numbersTitle: "Maskines just nu",
    quote: "Vi bygger Maskines varje dag tillsammans med våra användare — tydligare, tryggare och nyttigare för hela gemenskapen.",
    quoteBy: "Maskines löfte",
    faqTitle: "Vanliga frågor",
    faqs: [
      ["Vad kan jag göra på Maskines?", "Du kan köpa och sälja reservdelar, fordon och körutrustning samt hitta entusiaster och företag i Norden."],
      ["Vad kan jag sälja på Maskines?", "Du kan sälja reservdelar, kompletta fordon och körutrustning."]
    ],
    ctaTitle: "Hitta din nästa del redan i dag.",
    ctaButton: "Se annonser",
    stats: {
      registeredUser: ["registrerad användare", "registrerade användare"],
      activeListing: ["aktiv annons", "aktiva annonser"],
      country: ["land i annonser", "länder i annonser"],
      activeSeller: ["aktiv säljare", "aktiva säljare"]
    }
  },
  no: {
    kicker: "Om oss",
    titleTop: "Født av hobbyen.",
    titleHighlight: "Bygget for fellesskapet.",
    intro: "Maskines samler reservedeler, kjøretøy, kjøreutstyr og mennesker på én tydelig nordisk markedsplass.",
    marketplaceKicker: "Markedsplass",
    marketplaceTitle: "Alt for hobbyen. På ett sted.",
    searchPlaceholder: "Søk etter deler eller kjøretøy",
    searchCta: "Søk",
    categories: ["Reservedeler", "Kjøretøy", "Kjøreutstyr"],
    marketplaceActions: "Kjøp · Selg · Finn",
    storyTitle: "Historien vår",
    story: [
      "Maskines ble grunnlagt i mai 2026 ut fra entusiasters behov for enklere handel med reservedeler, kjøretøy og kjøreutstyr.",
      "Vi bygger tjenesten sammen med brukere, selgere og bedrifter i bransjen. Målet er en markedsplass der riktig produkt finnes raskt og handelen føles tydelig fra start til slutt."
    ],
    whyTitle: "Hvorfor Maskines?",
    features: [
      ["Finn riktig del raskere", "Smart søk og presise filtre hjelper deg med å finne riktig produkt uten unødvendig leting."],
      ["En tryggere markedsplass", "Tydelige annonser, selgerprofiler og felles regler støtter pålitelig handel."],
      ["Et nordisk fellesskap", "Maskines samler entusiaster, private selgere og bransjebedrifter i én tjeneste."],
      ["Fra entusiast til entusiast", "Tjenesten utvikles for praktiske behov, slik at mer tid går til kjøring, bygging og neste prosjekt."]
    ],
    numbersTitle: "Maskines akkurat nå",
    quote: "Vi bygger Maskines hver dag sammen med brukerne våre — tydeligere, tryggere og mer nyttig for hele fellesskapet.",
    quoteBy: "Maskines-løftet",
    faqTitle: "Ofte stilte spørsmål",
    faqs: [
      ["Hva kan jeg gjøre på Maskines?", "Du kan kjøpe og selge reservedeler, kjøretøy og kjøreutstyr, og finne entusiaster og bedrifter i Norden."],
      ["Hva kan jeg selge på Maskines?", "Du kan selge reservedeler, komplette kjøretøy og kjøreutstyr."]
    ],
    ctaTitle: "Finn din neste del allerede i dag.",
    ctaButton: "Se annonser",
    stats: {
      registeredUser: ["registrert bruker", "registrerte brukere"],
      activeListing: ["aktiv annonse", "aktive annonser"],
      country: ["land i annonser", "land i annonser"],
      activeSeller: ["aktiv selger", "aktive selgere"]
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
  if (value === null || value === undefined) return "…";
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

  const numberStats = [
    {
      value: formatStatValue(stats?.registeredUsers, locale),
      label: statLabel(stats?.registeredUsers, copy.stats.registeredUser[0], copy.stats.registeredUser[1])
    },
    {
      value: formatStatValue(stats?.activeListings, locale),
      label: statLabel(stats?.activeListings, copy.stats.activeListing[0], copy.stats.activeListing[1])
    },
    {
      value: formatStatValue(stats?.listingCountries, locale),
      label: statLabel(stats?.listingCountries, copy.stats.country[0], copy.stats.country[1])
    },
    {
      value: formatStatValue(stats?.activeSellers, locale),
      label: statLabel(stats?.activeSellers, copy.stats.activeSeller[0], copy.stats.activeSeller[1])
    }
  ];

  const categoryLinks = ["/varaosat", "/ajoneuvot", "/?category=Ajovarusteet"];

  return (
    <main className="about-showcase-page" data-no-auto-translate>
      <section className="about-showcase-hero" aria-labelledby="about-page-title">
        <div className="about-showcase-copy">
          <span className="about-showcase-kicker">{copy.kicker}</span>
          <h1 id="about-page-title">
            {copy.titleTop}
            <br />
            <span>{copy.titleHighlight}</span>
          </h1>
          <p>{copy.intro}</p>
        </div>

        <aside className="about-marketplace-panel" aria-label={copy.marketplaceTitle}>
          <span className="about-marketplace-kicker">{copy.marketplaceKicker}</span>
          <h2>{copy.marketplaceTitle}</h2>
          <form className="about-marketplace-search" action="/" method="get" role="search">
            <input name="q" type="search" placeholder={copy.searchPlaceholder} aria-label={copy.searchPlaceholder} />
            <button type="submit">{copy.searchCta}</button>
          </form>
          <nav className="about-marketplace-categories" aria-label={copy.marketplaceKicker}>
            {copy.categories.map((category, index) => (
              <Link key={category} href={categoryLinks[index]}>{category}</Link>
            ))}
          </nav>
          <strong className="about-marketplace-actions">{copy.marketplaceActions}</strong>
        </aside>
      </section>

      <section className="about-story" aria-labelledby="about-story-title">
        <span className="about-showcase-section-kicker">{copy.kicker}</span>
        <h2 id="about-story-title">{copy.storyTitle}</h2>
        <div className="about-story-copy">
          {copy.story.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </section>

      <section className="about-showcase-features" aria-labelledby="about-features-title">
        <h2 id="about-features-title">{copy.whyTitle}</h2>
        <div className="about-showcase-card-grid">
          {copy.features.map(([title, text], index) => (
            <article className="about-showcase-card" key={title}>
              <span className="about-showcase-card-number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-showcase-numbers" aria-labelledby="about-numbers-title">
        <h2 id="about-numbers-title">{copy.numbersTitle}</h2>
        <div className="about-showcase-number-grid">
          {numberStats.map((stat) => (
            <div className="about-showcase-number" key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <blockquote className="about-quote">
        <span aria-hidden="true">“</span>
        <div>
          <p>{copy.quote}</p>
          <cite>{copy.quoteBy}</cite>
        </div>
      </blockquote>

      <section className="about-faq" aria-labelledby="about-faq-title">
        <h2 id="about-faq-title">{copy.faqTitle}</h2>
        <div className="about-faq-list">
          {copy.faqs.map(([question, answer], index) => (
            <article className="about-faq-item" key={question}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{question}</h3>
                <p>{answer}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-cta" aria-label={copy.ctaTitle}>
        <h2>{copy.ctaTitle}</h2>
        <Link href="/ilmoitukset">{copy.ctaButton}</Link>
      </section>
    </main>
  );
}
