"use client";

import Link from "next/link";

import { useLanguage, type Locale } from "@/lib/i18n";

export type InfoPageCopy = {
  kicker: string;
  title: string;
  lead: string;
  visualLabel?: string;
  stats?: Array<{ value: string; label: string }>;
  cards?: Array<{ title: string; text: string }>;
  sections: Array<{ title: string; body: string[]; bullets?: string[] }>;
  actions?: Array<{ href: string; label: string; primary?: boolean; external?: boolean }>;
  summaryLabel?: string;
};

type InfoPageProps = {
  copy: Record<Locale, InfoPageCopy>;
};

export default function InfoPage({ copy }: InfoPageProps) {
  const { locale } = useLanguage();
  const current = copy[locale] ?? copy.fi;
  const { kicker, title, lead, visualLabel, stats = [], cards = [], sections, actions = [], summaryLabel } = current;

  return (
    <main className="info-page">
      <article className="info-shell">
        <section className="info-hero">
          <div className="info-hero-copy">
            <span className="info-kicker">{kicker}</span>
            <h1>{title}</h1>
            <p className="info-lead">{lead}</p>
            {actions.length > 0 ? (
              <div className="info-actions">
                {actions.map((action) =>
                  action.external ? (
                    <a
                      key={action.href}
                      className={action.primary ? "info-button" : "info-link"}
                      href={action.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {action.label}
                    </a>
                  ) : (
                    <Link key={action.href} className={action.primary ? "info-button" : "info-link"} href={action.href}>
                      {action.label}
                    </Link>
                  )
                )}
              </div>
            ) : null}
          </div>
          <div className="info-hero-visual" aria-label={visualLabel ?? title}>
            <span className="info-visual-badge">{kicker}</span>
            <strong>Maskines</strong>
            <small>{visualLabel ?? lead}</small>
            {stats.length > 0 ? (
              <div className="info-stat-grid">
                {stats.map((stat) => (
                  <span className="info-stat" key={`${stat.value}-${stat.label}`}>
                    <strong>{stat.value}</strong>
                    <small>{stat.label}</small>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {stats.length > 0 ? (
          <section className="info-stat-strip" aria-label={`${title} - luvut`}>
            {stats.map((stat) => (
              <div className="info-stat-item" key={`${stat.label}-${stat.value}`}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </section>
        ) : null}

        {cards.length > 0 ? (
          <section className="info-grid" aria-label={summaryLabel ?? `${title} - summary`}>
            {cards.map((card, index) => (
              <div className="info-card" key={card.title}>
                <span className="info-card-index">0{index + 1}</span>
                <h2>
                  <span>{card.title}</span>
                </h2>
                <p>{card.text}</p>
              </div>
            ))}
          </section>
        ) : null}

        <div className="info-content">
          {sections.map((section, index) => (
            <section className="info-section" key={section.title}>
              <h2>
                <span className="info-number">{index + 1}</span>
                <span>{section.title}</span>
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {actions.length > 0 ? (
          <section className="info-bottom-cta" aria-label="Seuraava toiminto">
            <div>
              <span>{kicker}</span>
              <strong>{title}</strong>
            </div>
            <div className="info-actions">
              {actions.map((action) => (
                action.external ? (
                  <a key={action.href} className={action.primary ? "info-button" : "info-link"} href={action.href} rel="noopener noreferrer" target="_blank">
                    {action.label}
                  </a>
                ) : (
                  <Link key={action.href} className={action.primary ? "info-button" : "info-link"} href={action.href}>
                    {action.label}
                  </Link>
                )
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
