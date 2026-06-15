"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  PackagePlus,
  Sparkles,
  Store
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { goBackOrFallback } from "@/lib/go-back";
import { useLanguage } from "@/lib/i18n";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import {
  getListingSlotUsage,
  getMyReferralStats,
  getProfileExtraSlots,
  spendUserPoints,
  supabase
} from "@/lib/supabase";
import {
  BASE_LISTING_SLOT_LIMIT,
  LISTING_SLOT_PLANS,
  addListingSlotPurchase,
  getListingSlotBonus,
  getListingSlotLimit,
  readListingSlotPurchases,
  type ListingSlotPlan,
  type ListingSlotPurchase
} from "@/lib/listing-slots";
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";

type ShopCache = {
  points: number;
  slotUsed: number;
  slotPurchases: ListingSlotPurchase[];
  dbExtraSlots: number;
};

export default function ShopPage() {
  if (!FEATURE_FLAGS.rewardsAndShop) {
    return <ShopDisabledPage />;
  }

  return <ShopEnabledPage />;
}

function ShopDisabledPage() {
  const router = useRouter();
  const { t } = useLanguage();
  return (
    <main className="profile-workspace shop-page">
      <section className="profile-card rewards-card">
        <button type="button" className="profile-back-link" onClick={() => goBackOrFallback(router)}>
          <ArrowLeft size={16} />
          {t.back}
        </button>
        <h1>Kauppa ei ole tällä hetkellä käytössä.</h1>
      </section>
    </main>
  );
}

function ShopEnabledPage() {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const sh = useMemo(() => ({
    fi:  { h1: "Osta etuja pisteillä", desc: "Käytä ansaittuja pisteitä ilmoituspaikkoihin. Pisteiden ostaminen oikealla rahalla on valmiina maksupalvelun yhdistämistä varten.", loginPrompt: "Kirjaudu sisään käyttääksesi pisteitä ja nähdäksesi ilmoituspaikkasi.", loginLink: "Kirjaudu", loading: "Ladataan kauppaa...", notEnoughPoints: (c: number) => `Pisteitä ei ole tarpeeksi. Tarvitset ${c.toLocaleString()} pistettä.`, buyFailed: (e: string) => `Osto ei onnistunut: ${e}`, buySuccess: (title: string, days: number) => `${title} lisätty käyttöön ${days} päiväksi.`, pointsAvailable: "Pisteitä käytössä", listingSlots: "Ilmoituspaikat", slotBase: (base: number, bonus: number) => `Vakiona ${base}${bonus > 0 ? ` + ${bonus} ostettua paikkaa` : ""}.`, slotTitle: "Ilmoituspaikat pisteillä", slotValidity: "30 pv voimassa", inUseNow: "Käytössä nyt", slotNote: "Lisäpaikat lasketaan aktiivisten ilmoitusten rajaan heti oston jälkeen.", pointsSuffix: "pistettä", validFor: (days: number, total: number) => `Voimassa ${days} päivää, raja yhteensä ${total}.`, buying: "Ostetaan...", buyWithPoints: "Osta pisteillä", noPoints: "Ei pisteitä", activePurchases: "Aktiiviset lisäpaikat", expiresAt: (d: string) => `päättyy ${d}`, cashTitle: "Osta pisteitä rahalla", cashDesc: "Valitse pistepaketti ja maksa maksupalveluilla. Pisteet lisätään tilille vasta kun maksu on vahvistettu palvelimella.", addPaypalId: "Lisää maksupalvelun tunnus", securityNote: "maksupalvelun salaisuus pysyy vain palvelimella. Tietokantaan tallennetaan order, capture ja lisätty piskemäärä, jotta samaa maksua ei hyvitetä kahdesti.", earnMore: "Ansaitse lisää pisteitä tehtävistä", loginRequired: "Kirjaudu sisään ennen maksua.", paymentFail: "maksupalvelu-maksu epäonnistui tai keskeytyi.", paymentOrderFail: "maksupalvelu-orderin luonti epäonnistui.", paymentNoOrderId: "maksupalvelu ei palauttanut order id:tä.", paymentSessionExpired: "Kirjautuminen vanheni. Kirjaudu uudelleen.", paymentCaptureFail: "Maksun vahvistus epäonnistui.", paymentSuccess: (p: string) => `Maksu onnistui. Tilillesi lisättiin ${p} pistettä.`, paymentLoadFail: "maksupalvelu-nappien lataus epäonnistui." },
    en:  { h1: "Buy benefits with points", desc: "Use your earned points for listing slots. Purchasing points with real money is ready for payment provider integration.", loginPrompt: "Log in to use points and see your listing slots.", loginLink: "Log in", loading: "Loading shop...", notEnoughPoints: (c: number) => `Not enough points. You need ${c.toLocaleString()} points.`, buyFailed: (e: string) => `Purchase failed: ${e}`, buySuccess: (title: string, days: number) => `${title} added for ${days} days.`, pointsAvailable: "Points available", listingSlots: "Listing slots", slotBase: (base: number, bonus: number) => `Default ${base}${bonus > 0 ? ` + ${bonus} purchased slots` : ""}.`, slotTitle: "Listing slots with points", slotValidity: "30 days valid", inUseNow: "Currently in use", slotNote: "Extra slots count toward the active listing limit immediately after purchase.", pointsSuffix: "points", validFor: (days: number, total: number) => `Valid for ${days} days, limit total ${total}.`, buying: "Buying...", buyWithPoints: "Buy with points", noPoints: "No points", activePurchases: "Active extra slots", expiresAt: (d: string) => `expires ${d}`, cashTitle: "Buy points with money", cashDesc: "Choose a point package and pay with maksupalvelu. Points are added to your account only after payment is confirmed on the server.", addPaypalId: "Add maksupalvelun tunnus", securityNote: "maksupalvelun salaisuus stays server-side only. The database stores order, capture and points added so the same payment is never credited twice.", earnMore: "Earn more points from quests", loginRequired: "Please log in before payment.", paymentFail: "maksupalvelu payment failed or was cancelled.", paymentOrderFail: "Failed to create maksupalvelu order.", paymentNoOrderId: "maksupalvelu did not return an order id.", paymentSessionExpired: "Session expired. Please log in again.", paymentCaptureFail: "Payment confirmation failed.", paymentSuccess: (p: string) => `Payment successful. ${p} points were added to your account.`, paymentLoadFail: "Failed to load maksupalvelu buttons." },
    sv:  { h1: "Köp förmåner med poäng", desc: "Använd dina tjänade poäng till annonsplatser. Köp av poäng med riktiga pengar är redo för betalningsleverantörens integration.", loginPrompt: "Logga in för att använda poäng och se dina annonsplatser.", loginLink: "Logga in", loading: "Laddar butiken...", notEnoughPoints: (c: number) => `Inte tillräckligt med poäng. Du behöver ${c.toLocaleString()} poäng.`, buyFailed: (e: string) => `Köpet misslyckades: ${e}`, buySuccess: (title: string, days: number) => `${title} tillagd i ${days} dagar.`, pointsAvailable: "Poäng tillgängliga", listingSlots: "Annonsplatser", slotBase: (base: number, bonus: number) => `Standard ${base}${bonus > 0 ? ` + ${bonus} köpta platser` : ""}.`, slotTitle: "Annonsplatser med poäng", slotValidity: "30 dagar giltig", inUseNow: "Används nu", slotNote: "Extra platser räknas mot gränsen för aktiva annonser direkt efter köpet.", pointsSuffix: "poäng", validFor: (days: number, total: number) => `Giltig ${days} dagar, gräns totalt ${total}.`, buying: "Köper...", buyWithPoints: "Köp med poäng", noPoints: "Inga poäng", activePurchases: "Aktiva extra platser", expiresAt: (d: string) => `upphör ${d}`, cashTitle: "Köp poäng med pengar", cashDesc: "Välj ett poängpaket och betala med maksupalvelu. Poäng läggs till kontot först när betalningen bekräftats på servern.", addPaypalId: "Lägg till maksupalvelun tunnus", securityNote: "maksupalvelun salaisuus stannar bara på servern. Databasen lagrar order, capture och tillagda poäng så att samma betalning aldrig krediteras två gånger.", earnMore: "Tjäna fler poäng från uppdrag", loginRequired: "Logga in före betalning.", paymentFail: "maksupalvelu-betalning misslyckades eller avbröts.", paymentOrderFail: "Det gick inte att skapa maksupalvelu-order.", paymentNoOrderId: "maksupalvelu returnerade inget order-id.", paymentSessionExpired: "Sessionen har gått ut. Logga in igen.", paymentCaptureFail: "Betalningsbekäftelse misslyckades.", paymentSuccess: (p: string) => `Betalning lyckades. ${p} poäng lades till ditt konto.`, paymentLoadFail: "Det gick inte att ladda maksupalvelu-knappar." },
    no:  { h1: "Kjøp fordeler med poeng", desc: "Bruk dine opptjente poeng til annonseplasser. Kjøp av poeng med ekte penger er klar for betalingsleverandørintegrasjon.", loginPrompt: "Logg inn for å bruke poeng og se annonseplassene dine.", loginLink: "Logg inn", loading: "Laster butikken...", notEnoughPoints: (c: number) => `Ikke nok poeng. Du trenger ${c.toLocaleString()} poeng.`, buyFailed: (e: string) => `Kjøpet mislyktes: ${e}`, buySuccess: (title: string, days: number) => `${title} lagt til i ${days} dager.`, pointsAvailable: "Tilgjengelige poeng", listingSlots: "Annonseplasser", slotBase: (base: number, bonus: number) => `Standard ${base}${bonus > 0 ? ` + ${bonus} kjøpte plasser` : ""}.`, slotTitle: "Annonseplasser med poeng", slotValidity: "30 dager gyldig", inUseNow: "I bruk nå", slotNote: "Ekstra plasser teller mot grensen for aktive annonser umiddelbart etter kjøp.", pointsSuffix: "poeng", validFor: (days: number, total: number) => `Gyldig ${days} dager, grense totalt ${total}.`, buying: "Kjøper...", buyWithPoints: "Kjøp med poeng", noPoints: "Ingen poeng", activePurchases: "Aktive ekstra plasser", expiresAt: (d: string) => `utløper ${d}`, cashTitle: "Kjøp poeng med penger", cashDesc: "Velg en poengpakke og betal med maksupalvelu. Poeng legges til kontoen først når betalingen er bekreftet på serveren.", addPaypalId: "Legg til maksupalvelun tunnus", securityNote: "maksupalvelun salaisuus forblir kun på serveren. Databasen lagrer ordre, capture og tillagte poeng slik at samme betaling ikke krediteres to ganger.", earnMore: "Tjen flere poeng fra oppdrag", loginRequired: "Logg inn før betaling.", paymentFail: "maksupalvelu-betaling mislyktes eller ble avbrutt.", paymentOrderFail: "Kunne ikke opprette maksupalvelu-ordre.", paymentNoOrderId: "maksupalvelu returnerte ikke noe ordre-id.", paymentSessionExpired: "Sesjonen utløp. Logg inn igjen.", paymentCaptureFail: "Betalingsbekreftelse mislyktes.", paymentSuccess: (p: string) => `Betaling vellykket. ${p} poeng ble lagt til kontoen din.`, paymentLoadFail: "Kunne ikke laste maksupalvelu-knapper." },
    et:  { h1: "Osta eeliseid punktidega", desc: "Kasuta teenitud punkte kuulutuskohtade jaoks. Punktide ostmine päris rahaga on valmis makselahenduse integreerimiseks.", loginPrompt: "Logi sisse, et kasutada punkte ja näha oma kuulutuskohti.", loginLink: "Logi sisse", loading: "Laadin poodi...", notEnoughPoints: (c: number) => `Punkte pole piisavalt. Vajad ${c.toLocaleString()} punkti.`, buyFailed: (e: string) => `Ost ebaõnnestus: ${e}`, buySuccess: (title: string, days: number) => `${title} lisatud ${days} päevaks.`, pointsAvailable: "Saadaval olevad punktid", listingSlots: "Kuulutuse kohad", slotBase: (base: number, bonus: number) => `Vaikimisi ${base}${bonus > 0 ? ` + ${bonus} ostetud kohta` : ""}.`, slotTitle: "Kuulutuskohad punktidega", slotValidity: "30 päeva kehtiv", inUseNow: "Praegu kasutuses", slotNote: "Lisekohad arvestatakse aktiivse kuulutuse limiidi alla kohe pärast ostu.", pointsSuffix: "punkti", validFor: (days: number, total: number) => `Kehtib ${days} päeva, limiit kokku ${total}.`, buying: "Ostetakse...", buyWithPoints: "Osta punktidega", noPoints: "Punkte pole", activePurchases: "Aktiivsed lisekohad", expiresAt: (d: string) => `lõpeb ${d}`, cashTitle: "Osta punkte rahaga", cashDesc: "Vali punktipakett ja maksa maksupalveluiga. Punktid lisatakse kontole alles pärast makse kinnitamist serveris.", addPaypalId: "Lisa maksupalvelun tunnus", securityNote: "maksupalvelun salaisuus jääb ainult serverisse. Andmebaasi salvestatakse tellimus, capture ja lisatud punktid, et sama makset ei krediteeritaks kaks korda.", earnMore: "Teeni rohkem punkte ülesannetest", loginRequired: "Logi sisse enne makset.", paymentFail: "maksupalvelu-makse ebaõnnestus või katkestati.", paymentOrderFail: "maksupalvelu-tellimuse loomine ebaõnnestus.", paymentNoOrderId: "maksupalvelu ei tagastanud tellimuse id-d.", paymentSessionExpired: "Seanss aegus. Logi uuesti sisse.", paymentCaptureFail: "Makse kinnitamine ebaõnnestus.", paymentSuccess: (p: string) => `Makse õnnestus. Sinu kontole lisati ${p} punkti.`, paymentLoadFail: "maksupalvelu-nuppude laadimine ebaõnnestus." }
  }[locale] ?? { h1: "", desc: "", loginPrompt: "", loginLink: t.login, loading: "...", notEnoughPoints: (c: number) => `${c}`, buyFailed: (e: string) => e, buySuccess: (title: string, days: number) => `${title} ${days}d`, pointsAvailable: "", listingSlots: "", slotBase: () => "", slotTitle: "", slotValidity: "", inUseNow: "", slotNote: "", pointsSuffix: "p", validFor: () => "", buying: "...", buyWithPoints: "", noPoints: "", activePurchases: "", expiresAt: (d: string) => d, cashTitle: "", cashDesc: "", addPaypalId: "", securityNote: "", earnMore: "", loginRequired: "", paymentFail: "", paymentOrderFail: "", paymentNoOrderId: "", paymentSessionExpired: "", paymentCaptureFail: "", paymentSuccess: (p: string) => p, paymentLoadFail: "" }), [locale, t.login]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [slotUsed, setSlotUsed] = useState(0);
  const [slotPurchases, setSlotPurchases] = useState<ListingSlotPurchase[]>([]);
  const [dbExtraSlots, setDbExtraSlots] = useState(0);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  const reload = useCallback(async (uid: string) => {
    const cacheKey = `shop:${uid}`;
    const cached = readCachedResource<ShopCache>(cacheKey);
    if (cached) {
      setPoints(cached.points);
      setSlotUsed(cached.slotUsed);
      setSlotPurchases(cached.slotPurchases);
      setDbExtraSlots(cached.dbExtraSlots);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const [stats, usage, extras] = await Promise.all([
        getMyReferralStats(uid),
        getListingSlotUsage(uid),
        getProfileExtraSlots(uid)
      ]);
      const next = {
        points: stats.points,
        slotUsed: usage.data,
        slotPurchases: readListingSlotPurchases(uid),
        dbExtraSlots: extras
      };
      setPoints(next.points);
      setSlotUsed(next.slotUsed);
      setSlotPurchases(next.slotPurchases);
      setDbExtraSlots(next.dbExtraSlots);
      writeCachedResource(cacheKey, next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    void reload(user.id);
  }, [reload, user]);

  async function buySlotPlan(plan: ListingSlotPlan) {
    if (!user || buyingPlan) return;

    setBuyingPlan(plan.id);
    setMessage(null);

    const result = await spendUserPoints(user.id, plan.cost);

    if (!result.success) {
      setMessage(
        result.error === "not_enough_points"
          ? sh.notEnoughPoints(plan.cost)
          : sh.buyFailed(result.error ?? "")
      );
      setBuyingPlan(null);
      return;
    }

    const nextPurchases = addListingSlotPurchase(user.id, plan);
    setPoints(result.points);
    setSlotPurchases(nextPurchases);
    setMessage(sh.buySuccess(plan.title, plan.days));
    setBuyingPlan(null);
    setTimeout(() => setMessage(null), 4200);
  }

  const slotLimit = user ? getListingSlotLimit(user.id, slotPurchases, dbExtraSlots) : BASE_LISTING_SLOT_LIMIT;
  const slotBonus = getListingSlotBonus(slotPurchases) + dbExtraSlots;
  const slotPercent = Math.min(100, Math.round((slotUsed / slotLimit) * 100));

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <button type="button" className="back-link" onClick={() => goBackOrFallback(router)}>
          <ArrowLeft size={18} />
          {t.back}
        </button>
        <LanguageSwitcher />
      </header>

      <section className="profile-workspace shop-workspace">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              <Store size={16} />
              {t.shop}
            </span>
            <h1>{sh.h1}</h1>
          </div>
          <p>{sh.desc}</p>
        </div>

        {!user && (
          <div className="profile-alert">
            <LockKeyhole size={20} />
            <span>{sh.loginPrompt}</span>
            <Link href="/auth">{sh.loginLink}</Link>
          </div>
        )}

        {user && loading && (
          <div className="profile-alert">
            <span>{sh.loading}</span>
          </div>
        )}

        {user && !loading && (
          <>
            <div className="shop-hero">
              <div className="shop-hero-balance">
                <Sparkles size={28} />
                <div>
                  <span>{sh.pointsAvailable}</span>
                  <strong>{points.toLocaleString()} p</strong>
                </div>
              </div>
              <div className="shop-hero-slot">
                <span>{sh.listingSlots}</span>
                <strong>{slotUsed} / {slotLimit}</strong>
                <small>{sh.slotBase(BASE_LISTING_SLOT_LIMIT, slotBonus)}</small>
              </div>
            </div>

            <div className="rewards-card slot-shop-card">
              <div className="rewards-card-head">
                <PackagePlus size={20} />
                <h2>{sh.slotTitle}</h2>
                <span className="rewards-points-badge">{sh.slotValidity}</span>
              </div>

              <div className="slot-shop-overview">
                <div>
                  <span>{sh.inUseNow}</span>
                  <strong>{slotUsed} / {slotLimit}</strong>
                  <small>{sh.slotNote}</small>
                </div>
                <div className="slot-shop-meter" aria-hidden="true">
                  <span style={{ width: `${slotPercent}%` }} />
                </div>
              </div>

              {message && <div className="quest-toast slot-shop-toast">{message}</div>}

              <div className="slot-plan-grid">
                {LISTING_SLOT_PLANS.map((plan) => {
                  const canBuy = points >= plan.cost;
                  const total = BASE_LISTING_SLOT_LIMIT + plan.slots;

                  return (
                    <div key={plan.id} className="slot-plan-card">
                      <div className="slot-plan-icon">
                        <PackagePlus size={22} />
                      </div>
                      <div className="slot-plan-body">
                        <span>{plan.cost.toLocaleString()} {sh.pointsSuffix}</span>
                        <strong>{plan.title}</strong>
                        <p>{plan.description}</p>
                        <small>
                          <Clock3 size={14} />
                          {sh.validFor(plan.days, total)}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="slot-plan-buy"
                        disabled={!canBuy || buyingPlan === plan.id}
                        onClick={() => buySlotPlan(plan)}
                      >
                        {buyingPlan === plan.id ? sh.buying : canBuy ? sh.buyWithPoints : sh.noPoints}
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>

            <div className="shop-small-links">
              <Link href="/rewards">
                <CheckCircle2 size={16} />
                {sh.earnMore}
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
