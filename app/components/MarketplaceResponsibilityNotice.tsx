"use client";

import Link from "next/link";
import { AlertTriangle, Store } from "lucide-react";

import { useLanguage, type Locale } from "@/lib/i18n";

type NoticeAudience = "buyer" | "seller";

const noticeCopy: Record<Locale, Record<NoticeAudience, { title: string; body: string; legal: string; terms: string }>> = {
  fi: {
    buyer: {
      title: "Kauppa tehdään myyjän kanssa",
      body: "Maskines tarjoaa markkinapaikan ja maksamisen teknisen välityksen, mutta ei ole tuotteen myyjä tai kaupan osapuoli. Myyjä vastaa tuotteen tiedoista, kunnosta, toimituksesta, palautuksista, hyvityksistä ja muista kauppaan liittyvistä velvoitteista. Ongelmatilanteessa ota ensin yhteyttä myyjään.",
      legal: "Tämä ei rajoita pakottavaan lainsäädäntöön perustuvia oikeuksiasi eikä Maskinesin vastuuta omasta palvelustaan.",
      terms: "Lue käyttöehdot",
    },
    seller: {
      title: "Myyjä vastaa kaupasta",
      body: "Kun tarjoat suoramaksun, sinä olet tuotteen myyjä ja ostajan sopimuskumppani. Vastaat tuotteen tiedoista ja kunnosta sekä toimituksista, palautuksista, reklamaatioista, hyvityksistä ja muista lakisääteisistä myyjän velvoitteista. Maskines vastaa omasta alustapalvelustaan, ei myymästäsi tuotteesta.",
      legal: "Vastuunjako ei rajoita pakottavan lainsäädännön mukaisia oikeuksia tai vastuita.",
      terms: "Lue käyttöehdot",
    },
  },
  en: {
    buyer: {
      title: "Your purchase is with the seller",
      body: "Maskines provides the marketplace and technical payment facilitation, but is not the product seller or a party to the sale. The seller is responsible for product information, condition, delivery, returns, refunds and other obligations related to the sale. Contact the seller first if a problem occurs.",
      legal: "This does not limit your mandatory statutory rights or Maskines' liability for its own service.",
      terms: "Read the Terms of Use",
    },
    seller: {
      title: "The seller is responsible for the sale",
      body: "When you offer direct payment, you are the product seller and the buyer's contracting party. You are responsible for product information and condition, delivery, returns, complaints, refunds and other statutory seller obligations. Maskines is responsible for its own platform service, not the product you sell.",
      legal: "This allocation does not limit rights or liabilities under mandatory law.",
      terms: "Read the Terms of Use",
    },
  },
  sv: {
    buyer: {
      title: "Köpet görs med säljaren",
      body: "Maskines tillhandahåller marknadsplatsen och den tekniska betalningsförmedlingen men är inte produktens säljare eller part i köpet. Säljaren ansvarar för produktuppgifter, skick, leverans, returer, återbetalningar och andra skyldigheter som gäller köpet. Kontakta först säljaren vid problem.",
      legal: "Detta begränsar inte dina tvingande lagstadgade rättigheter eller Maskines ansvar för sin egen tjänst.",
      terms: "Läs användarvillkoren",
    },
    seller: {
      title: "Säljaren ansvarar för köpet",
      body: "När du erbjuder direktbetalning är du produktens säljare och köparens avtalspart. Du ansvarar för produktuppgifter och skick, leveranser, returer, reklamationer, återbetalningar och övriga lagstadgade säljarförpliktelser. Maskines ansvarar för sin egen plattformstjänst, inte för produkten du säljer.",
      legal: "Ansvarsfördelningen begränsar inte rättigheter eller ansvar enligt tvingande lag.",
      terms: "Läs användarvillkoren",
    },
  },
  no: {
    buyer: {
      title: "Kjøpet gjøres med selgeren",
      body: "Maskines tilbyr markedsplassen og den tekniske betalingsformidlingen, men er ikke selger av produktet eller part i handelen. Selgeren er ansvarlig for produktopplysninger, tilstand, levering, returer, refusjoner og andre plikter knyttet til handelen. Kontakt selgeren først dersom det oppstår et problem.",
      legal: "Dette begrenser ikke dine ufravikelige lovfestede rettigheter eller Maskines' ansvar for sin egen tjeneste.",
      terms: "Les brukervilkårene",
    },
    seller: {
      title: "Selgeren er ansvarlig for handelen",
      body: "Når du tilbyr direktebetaling, er du selger av produktet og kjøperens avtalepart. Du er ansvarlig for produktopplysninger og tilstand, levering, returer, reklamasjoner, refusjoner og andre lovpålagte selgerplikter. Maskines er ansvarlig for sin egen plattformtjeneste, ikke produktet du selger.",
      legal: "Ansvarsfordelingen begrenser ikke rettigheter eller ansvar etter ufravikelig lov.",
      terms: "Les brukervilkårene",
    },
  },
};

export default function MarketplaceResponsibilityNotice({
  audience = "buyer",
  compact = false,
}: {
  audience?: NoticeAudience;
  compact?: boolean;
}) {
  const { locale } = useLanguage();
  const copy = noticeCopy[locale][audience];
  const Icon = audience === "seller" ? Store : AlertTriangle;

  return (
    <aside className={`marketplace-responsibility-notice${compact ? " is-compact" : ""}`} aria-label={copy.title}>
      <span className="marketplace-responsibility-icon" aria-hidden="true">
        <Icon size={compact ? 18 : 22} />
      </span>
      <div className="marketplace-responsibility-copy">
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
        <small>
          <span>{copy.legal}</span>
          <span><Link href="/terms">{copy.terms}</Link>.</span>
        </small>
      </div>
      <style jsx>{`
        .marketplace-responsibility-notice {
          align-items: flex-start;
          background: linear-gradient(135deg, rgba(255, 250, 245, 0.99), rgba(255, 244, 232, 0.97));
          border: 1px solid rgba(234, 88, 12, 0.28);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(49, 22, 8, 0.08);
          color: #7c2d12;
          display: grid;
          gap: 13px;
          grid-column: 1 / -1;
          grid-template-columns: 38px minmax(0, 1fr);
          line-height: 1.5;
          overflow: hidden;
          padding: 16px 18px;
          position: relative;
          width: 100%;
        }
        .marketplace-responsibility-notice::before {
          background: #f97316;
          bottom: 0;
          content: "";
          left: 0;
          position: absolute;
          top: 0;
          width: 3px;
        }
        .marketplace-responsibility-icon {
          align-items: center;
          background: rgba(249, 115, 22, 0.1);
          border: 1px solid rgba(234, 88, 12, 0.18);
          border-radius: 10px;
          color: #ea580c;
          display: flex;
          height: 38px;
          justify-content: center;
          width: 38px;
        }
        .marketplace-responsibility-copy { min-width: 0; }
        .marketplace-responsibility-notice strong {
          color: #431407;
          display: block;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.35;
        }
        .marketplace-responsibility-notice p {
          color: #7c2d12;
          font-size: 13px;
          line-height: 1.55;
          margin: 4px 0 10px;
          max-width: 90ch;
        }
        .marketplace-responsibility-notice small {
          align-items: baseline;
          border-top: 1px solid rgba(234, 88, 12, 0.14);
          color: #9a3412;
          display: flex;
          flex-wrap: wrap;
          font-size: 11px;
          gap: 3px 8px;
          line-height: 1.45;
          padding-top: 8px;
        }
        .marketplace-responsibility-notice a {
          color: #9a3412;
          font-weight: 900;
          text-decoration: underline;
          text-underline-offset: 2px;
          white-space: nowrap;
        }
        .marketplace-responsibility-notice.is-compact { gap: 12px; padding: 14px 16px; }
        .marketplace-responsibility-notice.is-compact p { font-size: 12px; margin-bottom: 8px; }
        @media (max-width: 520px) {
          .marketplace-responsibility-notice,
          .marketplace-responsibility-notice.is-compact {
            gap: 10px;
            grid-template-columns: 34px minmax(0, 1fr);
            padding: 13px 13px 13px 15px;
          }
          .marketplace-responsibility-icon { border-radius: 9px; height: 34px; width: 34px; }
          .marketplace-responsibility-notice p { line-height: 1.5; }
        }
        @media (prefers-color-scheme: dark) {
          .marketplace-responsibility-notice {
            background: linear-gradient(135deg, rgba(67, 20, 7, 0.9), rgba(49, 17, 5, 0.94));
            border-color: rgba(251, 146, 60, 0.38);
            color: #fed7aa;
          }
          .marketplace-responsibility-icon {
            background: rgba(251, 146, 60, 0.12);
            border-color: rgba(251, 146, 60, 0.28);
            color: #fb923c;
          }
          .marketplace-responsibility-notice strong { color: #fff7ed; }
          .marketplace-responsibility-notice p,
          .marketplace-responsibility-notice small,
          .marketplace-responsibility-notice a { color: #fed7aa; }
        }
      `}</style>
    </aside>
  );
}
