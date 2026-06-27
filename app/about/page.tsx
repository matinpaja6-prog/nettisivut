"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
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

const featureCards = [
  {
    icon: Search,
    title: "Oikea osa nopeasti",
    text: "Tehokas haku ja selkeät ilmoitukset auttavat löytämään juuri sen oikean osan."
  },
  {
    icon: Tag,
    title: "Myy helpommin, myy enemmän",
    text: "Yksi ilmoitus, monta osaa. Parempi näkyvyys tuo enemmän ostajia ja parempia kauppoja."
  },
  {
    icon: ShieldCheck,
    title: "Turvallinen kauppapaikka",
    text: "Luotettava ympäristö ja selkeät pelisäännöt suojaavat sekä ostajaa että myyjää."
  },
  {
    icon: Headphones,
    title: "Apua aina tarvittaessa",
    text: "Asiakastuki ja ohjeet ovat aina saatavilla, kun tarvitset apua eteenpäin."
  }
];

type AboutStats = {
  registeredUsers: number;
  activeListings: number;
  activeSellers: number;
  listingLocations: number;
  listingCountries: number;
  vehicleClasses: number;
};

function formatStatValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "...";
  return value.toLocaleString("fi-FI");
}

function statLabel(value: number | null | undefined, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

export default function AboutPage() {
  const { locale } = useLanguage();
  const [stats, setStats] = useState<AboutStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/about-stats")
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
      value: formatStatValue(stats?.vehicleClasses),
      label: statLabel(stats?.vehicleClasses, "ajoneuvoluokka ilmoituksissa", "ajoneuvoluokkaa ilmoituksissa")
    },
    {
      icon: Tag,
      value: formatStatValue(stats?.activeListings),
      label: statLabel(stats?.activeListings, "aktiivinen ilmoitus", "aktiivista ilmoitusta")
    },
    {
      icon: HandHeart,
      value: formatStatValue(stats?.activeSellers),
      label: statLabel(stats?.activeSellers, "aktiivinen myyjä", "aktiivista myyjää")
    }
  ];

  const numberStats = [
    {
      icon: UsersRound,
      value: formatStatValue(stats?.registeredUsers),
      label: statLabel(stats?.registeredUsers, "rekisteröitynyt käyttäjä", "rekisteröitynyttä käyttäjää")
    },
    {
      icon: Tag,
      value: formatStatValue(stats?.activeListings),
      label: statLabel(stats?.activeListings, "aktiivinen ilmoitus", "aktiivista ilmoitusta")
    },
    {
      icon: Globe2,
      value: formatStatValue(stats?.listingCountries),
      label: statLabel(stats?.listingCountries, "maa ilmoituksissa", "maata ilmoituksissa")
    },
    {
      icon: ThumbsUp,
      value: formatStatValue(stats?.activeSellers),
      label: statLabel(stats?.activeSellers, "aktiivinen myyjä", "aktiivista myyjää")
    }
  ];

  return (
    <main className="about-showcase-page">
        <section className="about-showcase-hero">
          <div className="about-showcase-copy">
            <span className="about-showcase-kicker">Tietoa meistä</span>
            <h1>
              Varaosamaailma.
              <br />
              Rakennettu <span>harrastajille.</span>
            </h1>
            <p>
              Maskines kokoaa moottorikelkkojen, mönkijöiden, motocross-pyörien ja mopojen
              varaosat yhteen selkeään paikkaan. Tavoitteenamme on tehdä oikean osan
              löytämisestä nopeaa ja myymisestä vaivatonta.
            </p>
            <div className="about-showcase-actions">
              <Link className="about-showcase-primary" href={pagePath("sell", locale)}>
                Luo ilmoitus
              </Link>
              <Link className="about-showcase-secondary" href={pagePath("faq", locale)}>
                Katso ohjeet
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <aside className="about-showcase-stats" aria-label="Tietoa Maskinesista">
            <span>Tietoa Maskinesista</span>
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
          <span className="about-showcase-section-kicker">Miksi Maskines?</span>
          <h2 id="about-features-title">Tehty harrastajille, harrastajien kanssa.</h2>
          <p>Ymmärrämme tarpeesi, koska jaamme saman intohimon.</p>

          <div className="about-showcase-card-grid">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <article className="about-showcase-card" key={card.title}>
                  <span className="about-showcase-card-icon">
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="about-showcase-numbers" aria-labelledby="about-numbers-title">
          <span className="about-showcase-section-kicker">Maskines lukuina</span>
          <h2 id="about-numbers-title">Vahva yhteisö, joka kasvaa joka päivä.</h2>

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
              <h3>Missiomme</h3>
              <p>
                Haluamme olla Pohjoismaiden johtava varaosamarkkinapaikka, jossa jokainen osa
                löytää uuden elämän ja jokainen kauppa vie harrastusta eteenpäin.
              </p>
            </div>
          </article>
        </section>

        <section className="about-showcase-community" aria-label="Yhteisön lupaus">
          <HandHeart size={28} aria-hidden="true" />
          <div>
            <h2>Harrastajalta harrastajalle.</h2>
            <p>
              Maskines tekee varaosien ostamisesta ja myymisestä selkeämpää, jotta aikaa jää
              sille mikä oikeasti kiinnostaa: ajamiselle, rakentamiselle ja seuraavalle projektille.
            </p>
          </div>
        </section>
    </main>
  );
}
