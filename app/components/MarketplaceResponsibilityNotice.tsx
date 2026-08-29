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
      <Icon size={compact ? 18 : 22} aria-hidden="true" />
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
        <small>{copy.legal} <Link href="/terms">{copy.terms}</Link>.</small>
      </div>
      <style jsx>{`
        .marketplace-responsibility-notice {
          align-items: flex-start;
          background: rgba(255, 247, 237, 0.97);
          border: 1px solid rgba(234, 88, 12, 0.32);
          border-radius: 14px;
          color: #7c2d12;
          display: grid;
          gap: 12px;
          grid-template-columns: auto minmax(0, 1fr);
          line-height: 1.5;
          padding: 16px;
          width: 100%;
        }
        .marketplace-responsibility-notice > :global(svg) { margin-top: 2px; }
        .marketplace-responsibility-notice strong { color: #431407; display: block; font-size: 14px; }
        .marketplace-responsibility-notice p { color: #7c2d12; font-size: 13px; margin: 4px 0 7px; }
        .marketplace-responsibility-notice small { color: #9a3412; display: block; font-size: 11px; }
        .marketplace-responsibility-notice a { color: #9a3412; font-weight: 900; text-decoration: underline; text-underline-offset: 2px; }
        .marketplace-responsibility-notice.is-compact { gap: 9px; padding: 12px; }
        .marketplace-responsibility-notice.is-compact p { font-size: 12px; }
        @media (prefers-color-scheme: dark) {
          .marketplace-responsibility-notice {
            background: rgba(67, 20, 7, 0.88);
            border-color: rgba(251, 146, 60, 0.38);
            color: #fed7aa;
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
