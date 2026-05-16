"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Coins,
  CreditCard,
  LockKeyhole,
  PackagePlus,
  ShieldCheck,
  Sparkles,
  Store
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n";
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
import { POINT_PACKAGES } from "@/lib/point-packages";

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        style?: Record<string, string | number | boolean>;
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID?: string }) => Promise<void>;
        onError: (error: unknown) => void;
      }) => {
        render: (selector: string) => Promise<void>;
      };
    };
  }
}

export default function ShopPage() {
  const { locale, t } = useLanguage();
  const sh = useMemo(() => ({
    fi:  { h1: "Osta etuja pisteillä", desc: "Käytä ansaittuja pisteitä ilmoituspaikkoihin. Pisteiden ostaminen oikealla rahalla on valmiina maksupalvelun yhdistämistä varten.", loginPrompt: "Kirjaudu sisään käyttääksesi pisteitä ja nähdäksesi ilmoituspaikkasi.", loginLink: "Kirjaudu", loading: "Ladataan kauppaa...", notEnoughPoints: (c: number) => `Pisteitä ei ole tarpeeksi. Tarvitset ${c.toLocaleString()} pistettä.`, buyFailed: (e: string) => `Osto ei onnistunut: ${e}`, buySuccess: (title: string, days: number) => `${title} lisätty käyttöön ${days} päiväksi.`, pointsAvailable: "Pisteitä käytössä", listingSlots: "Ilmoituspaikat", slotBase: (base: number, bonus: number) => `Vakiona ${base}${bonus > 0 ? ` + ${bonus} ostettua paikkaa` : ""}.`, slotTitle: "Ilmoituspaikat pisteillä", slotValidity: "30 pv voimassa", inUseNow: "Käytössä nyt", slotNote: "Lisäpaikat lasketaan aktiivisten ilmoitusten rajaan heti oston jälkeen.", pointsSuffix: "pistettä", validFor: (days: number, total: number) => `Voimassa ${days} päivää, raja yhteensä ${total}.`, buying: "Ostetaan...", buyWithPoints: "Osta pisteillä", noPoints: "Ei pisteitä", activePurchases: "Aktiiviset lisäpaikat", expiresAt: (d: string) => `päättyy ${d}`, cashTitle: "Osta pisteitä rahalla", cashDesc: "Valitse pistepaketti ja maksa PayPalilla. Pisteet lisätään tilille vasta kun maksu on vahvistettu palvelimella.", addPaypalId: "Lisää PayPal client id", securityNote: "PayPal secret pysyy vain palvelimella. Tietokantaan tallennetaan order, capture ja lisätty piskemäärä, jotta samaa maksua ei hyvitetä kahdesti.", earnMore: "Ansaitse lisää pisteitä tehtävistä", loginRequired: "Kirjaudu sisään ennen maksua.", paypalFail: "PayPal-maksu epäonnistui tai keskeytyi.", paypalOrderFail: "PayPal-orderin luonti epäonnistui.", paypalNoOrderId: "PayPal ei palauttanut order id:tä.", paypalSessionExpired: "Kirjautuminen vanheni. Kirjaudu uudelleen.", paypalCaptureFail: "Maksun vahvistus epäonnistui.", paypalSuccess: (p: string) => `Maksu onnistui. Tilillesi lisättiin ${p} pistettä.`, paypalLoadFail: "PayPal-nappien lataus epäonnistui." },
    en:  { h1: "Buy benefits with points", desc: "Use your earned points for listing slots. Purchasing points with real money is ready for payment provider integration.", loginPrompt: "Log in to use points and see your listing slots.", loginLink: "Log in", loading: "Loading shop...", notEnoughPoints: (c: number) => `Not enough points. You need ${c.toLocaleString()} points.`, buyFailed: (e: string) => `Purchase failed: ${e}`, buySuccess: (title: string, days: number) => `${title} added for ${days} days.`, pointsAvailable: "Points available", listingSlots: "Listing slots", slotBase: (base: number, bonus: number) => `Default ${base}${bonus > 0 ? ` + ${bonus} purchased slots` : ""}.`, slotTitle: "Listing slots with points", slotValidity: "30 days valid", inUseNow: "Currently in use", slotNote: "Extra slots count toward the active listing limit immediately after purchase.", pointsSuffix: "points", validFor: (days: number, total: number) => `Valid for ${days} days, limit total ${total}.`, buying: "Buying...", buyWithPoints: "Buy with points", noPoints: "No points", activePurchases: "Active extra slots", expiresAt: (d: string) => `expires ${d}`, cashTitle: "Buy points with money", cashDesc: "Choose a point package and pay with PayPal. Points are added to your account only after payment is confirmed on the server.", addPaypalId: "Add PayPal client id", securityNote: "PayPal secret stays server-side only. The database stores order, capture and points added so the same payment is never credited twice.", earnMore: "Earn more points from quests", loginRequired: "Please log in before payment.", paypalFail: "PayPal payment failed or was cancelled.", paypalOrderFail: "Failed to create PayPal order.", paypalNoOrderId: "PayPal did not return an order id.", paypalSessionExpired: "Session expired. Please log in again.", paypalCaptureFail: "Payment confirmation failed.", paypalSuccess: (p: string) => `Payment successful. ${p} points were added to your account.`, paypalLoadFail: "Failed to load PayPal buttons." },
    sv:  { h1: "Köp förmåner med poäng", desc: "Använd dina tjänade poäng till annonsplatser. Köp av poäng med riktiga pengar är redo för betalningsleverantörens integration.", loginPrompt: "Logga in för att använda poäng och se dina annonsplatser.", loginLink: "Logga in", loading: "Laddar butiken...", notEnoughPoints: (c: number) => `Inte tillräckligt med poäng. Du behöver ${c.toLocaleString()} poäng.`, buyFailed: (e: string) => `Köpet misslyckades: ${e}`, buySuccess: (title: string, days: number) => `${title} tillagd i ${days} dagar.`, pointsAvailable: "Poäng tillgängliga", listingSlots: "Annonsplatser", slotBase: (base: number, bonus: number) => `Standard ${base}${bonus > 0 ? ` + ${bonus} köpta platser` : ""}.`, slotTitle: "Annonsplatser med poäng", slotValidity: "30 dagar giltig", inUseNow: "Används nu", slotNote: "Extra platser räknas mot gränsen för aktiva annonser direkt efter köpet.", pointsSuffix: "poäng", validFor: (days: number, total: number) => `Giltig ${days} dagar, gräns totalt ${total}.`, buying: "Köper...", buyWithPoints: "Köp med poäng", noPoints: "Inga poäng", activePurchases: "Aktiva extra platser", expiresAt: (d: string) => `upphör ${d}`, cashTitle: "Köp poäng med pengar", cashDesc: "Välj ett poängpaket och betala med PayPal. Poäng läggs till kontot först när betalningen bekräftats på servern.", addPaypalId: "Lägg till PayPal client id", securityNote: "PayPal secret stannar bara på servern. Databasen lagrar order, capture och tillagda poäng så att samma betalning aldrig krediteras två gånger.", earnMore: "Tjäna fler poäng från uppdrag", loginRequired: "Logga in före betalning.", paypalFail: "PayPal-betalning misslyckades eller avbröts.", paypalOrderFail: "Det gick inte att skapa PayPal-order.", paypalNoOrderId: "PayPal returnerade inget order-id.", paypalSessionExpired: "Sessionen har gått ut. Logga in igen.", paypalCaptureFail: "Betalningsbekäftelse misslyckades.", paypalSuccess: (p: string) => `Betalning lyckades. ${p} poäng lades till ditt konto.`, paypalLoadFail: "Det gick inte att ladda PayPal-knappar." },
    no:  { h1: "Kjøp fordeler med poeng", desc: "Bruk dine opptjente poeng til annonseplasser. Kjøp av poeng med ekte penger er klar for betalingsleverandørintegrasjon.", loginPrompt: "Logg inn for å bruke poeng og se annonseplassene dine.", loginLink: "Logg inn", loading: "Laster butikken...", notEnoughPoints: (c: number) => `Ikke nok poeng. Du trenger ${c.toLocaleString()} poeng.`, buyFailed: (e: string) => `Kjøpet mislyktes: ${e}`, buySuccess: (title: string, days: number) => `${title} lagt til i ${days} dager.`, pointsAvailable: "Tilgjengelige poeng", listingSlots: "Annonseplasser", slotBase: (base: number, bonus: number) => `Standard ${base}${bonus > 0 ? ` + ${bonus} kjøpte plasser` : ""}.`, slotTitle: "Annonseplasser med poeng", slotValidity: "30 dager gyldig", inUseNow: "I bruk nå", slotNote: "Ekstra plasser teller mot grensen for aktive annonser umiddelbart etter kjøp.", pointsSuffix: "poeng", validFor: (days: number, total: number) => `Gyldig ${days} dager, grense totalt ${total}.`, buying: "Kjøper...", buyWithPoints: "Kjøp med poeng", noPoints: "Ingen poeng", activePurchases: "Aktive ekstra plasser", expiresAt: (d: string) => `utløper ${d}`, cashTitle: "Kjøp poeng med penger", cashDesc: "Velg en poengpakke og betal med PayPal. Poeng legges til kontoen først når betalingen er bekreftet på serveren.", addPaypalId: "Legg til PayPal client id", securityNote: "PayPal secret forblir kun på serveren. Databasen lagrer ordre, capture og tillagte poeng slik at samme betaling ikke krediteres to ganger.", earnMore: "Tjen flere poeng fra oppdrag", loginRequired: "Logg inn før betaling.", paypalFail: "PayPal-betaling mislyktes eller ble avbrutt.", paypalOrderFail: "Kunne ikke opprette PayPal-ordre.", paypalNoOrderId: "PayPal returnerte ikke noe ordre-id.", paypalSessionExpired: "Sesjonen utløp. Logg inn igjen.", paypalCaptureFail: "Betalingsbekreftelse mislyktes.", paypalSuccess: (p: string) => `Betaling vellykket. ${p} poeng ble lagt til kontoen din.`, paypalLoadFail: "Kunne ikke laste PayPal-knapper." },
    et:  { h1: "Osta eeliseid punktidega", desc: "Kasuta teenitud punkte kuulutuskohtade jaoks. Punktide ostmine päris rahaga on valmis makselahenduse integreerimiseks.", loginPrompt: "Logi sisse, et kasutada punkte ja näha oma kuulutuskohti.", loginLink: "Logi sisse", loading: "Laadin poodi...", notEnoughPoints: (c: number) => `Punkte pole piisavalt. Vajad ${c.toLocaleString()} punkti.`, buyFailed: (e: string) => `Ost ebaõnnestus: ${e}`, buySuccess: (title: string, days: number) => `${title} lisatud ${days} päevaks.`, pointsAvailable: "Saadaval olevad punktid", listingSlots: "Kuulutuse kohad", slotBase: (base: number, bonus: number) => `Vaikimisi ${base}${bonus > 0 ? ` + ${bonus} ostetud kohta` : ""}.`, slotTitle: "Kuulutuskohad punktidega", slotValidity: "30 päeva kehtiv", inUseNow: "Praegu kasutuses", slotNote: "Lisekohad arvestatakse aktiivse kuulutuse limiidi alla kohe pärast ostu.", pointsSuffix: "punkti", validFor: (days: number, total: number) => `Kehtib ${days} päeva, limiit kokku ${total}.`, buying: "Ostetakse...", buyWithPoints: "Osta punktidega", noPoints: "Punkte pole", activePurchases: "Aktiivsed lisekohad", expiresAt: (d: string) => `lõpeb ${d}`, cashTitle: "Osta punkte rahaga", cashDesc: "Vali punktipakett ja maksa PayPaliga. Punktid lisatakse kontole alles pärast makse kinnitamist serveris.", addPaypalId: "Lisa PayPal client id", securityNote: "PayPal secret jääb ainult serverisse. Andmebaasi salvestatakse tellimus, capture ja lisatud punktid, et sama makset ei krediteeritaks kaks korda.", earnMore: "Teeni rohkem punkte ülesannetest", loginRequired: "Logi sisse enne makset.", paypalFail: "PayPal-makse ebaõnnestus või katkestati.", paypalOrderFail: "PayPal-tellimuse loomine ebaõnnestus.", paypalNoOrderId: "PayPal ei tagastanud tellimuse id-d.", paypalSessionExpired: "Seanss aegus. Logi uuesti sisse.", paypalCaptureFail: "Makse kinnitamine ebaõnnestus.", paypalSuccess: (p: string) => `Makse õnnestus. Sinu kontole lisati ${p} punkti.`, paypalLoadFail: "PayPal-nuppude laadimine ebaõnnestus." }
  }[locale] ?? { h1: "", desc: "", loginPrompt: "", loginLink: t.login, loading: "...", notEnoughPoints: (c: number) => `${c}`, buyFailed: (e: string) => e, buySuccess: (title: string, days: number) => `${title} ${days}d`, pointsAvailable: "", listingSlots: "", slotBase: () => "", slotTitle: "", slotValidity: "", inUseNow: "", slotNote: "", pointsSuffix: "p", validFor: () => "", buying: "...", buyWithPoints: "", noPoints: "", activePurchases: "", expiresAt: (d: string) => d, cashTitle: "", cashDesc: "", addPaypalId: "", securityNote: "", earnMore: "", loginRequired: "", paypalFail: "", paypalOrderFail: "", paypalNoOrderId: "", paypalSessionExpired: "", paypalCaptureFail: "", paypalSuccess: (p: string) => p, paypalLoadFail: "" }), [locale, t.login]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [slotUsed, setSlotUsed] = useState(0);
  const [slotPurchases, setSlotPurchases] = useState<ListingSlotPurchase[]>([]);
  const [dbExtraSlots, setDbExtraSlots] = useState(0);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

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
    setLoading(true);
    try {
      const [stats, usage, extras] = await Promise.all([
        getMyReferralStats(uid),
        getListingSlotUsage(uid),
        getProfileExtraSlots(uid)
      ]);
      setPoints(stats.points);
      setSlotUsed(usage.data);
      setSlotPurchases(readListingSlotPurchases(uid));
      setDbExtraSlots(extras);
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

  useEffect(() => {
    if (!user || !paypalClientId) return;

    if (window.paypal) {
      setPaypalReady(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-paypal-sdk]");

    if (existing) {
      existing.addEventListener("load", () => setPaypalReady(true), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=EUR&intent=capture`;
    script.async = true;
    script.dataset.paypalSdk = "true";
    script.onload = () => setPaypalReady(true);
    script.onerror = () => setPaymentMessage(sh.paypalLoadFail);
    document.body.appendChild(script);
  }, [paypalClientId, sh.paypalLoadFail, user]);

  useEffect(() => {
    if (!paypalReady || !user || !supabase) return;

    const client = supabase;

    POINT_PACKAGES.forEach((pack) => {
      const containerId = `paypal-buttons-${pack.id}`;
      const container = document.getElementById(containerId);

      if (!container || container.childElementCount > 0) return;

      window.paypal?.Buttons({
        style: {
          layout: "vertical",
          color: "blue",
          shape: "rect",
          label: "pay",
          height: 40
        },
        createOrder: async () => {
          setPaymentMessage(null);
          const { data } = await client.auth.getSession();
          const token = data.session?.access_token;

          if (!token) {
            throw new Error(sh.loginRequired);
          }

          const response = await fetch("/api/paypal/create-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ packageId: pack.id })
          });

          const payload = await response.json() as { orderId?: string; error?: string };

          if (!response.ok || !payload.orderId) {
            throw new Error(payload.error ?? sh.paypalOrderFail);
          }

          return payload.orderId;
        },
        onApprove: async (data) => {
          const orderId = data.orderID;

          if (!orderId) {
            setPaymentMessage(sh.paypalNoOrderId);
            return;
          }

          const sessionResult = await client.auth.getSession();
          const token = sessionResult.data.session?.access_token;

          if (!token) {
            setPaymentMessage(sh.paypalSessionExpired);
            return;
          }

          const response = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ orderId })
          });

          const payload = await response.json() as { success?: boolean; pointsAdded?: number; error?: string };

          if (!response.ok || !payload.success) {
            setPaymentMessage(payload.error ?? sh.paypalCaptureFail);
            return;
          }

          setPaymentMessage(sh.paypalSuccess((payload.pointsAdded ?? pack.points).toLocaleString()));
          await reload(user.id);
        },
        onError: (error) => {
          console.error("PayPal error", error);
          setPaymentMessage(sh.paypalFail);
        }
      }).render(`#${containerId}`).catch((error) => {
        console.error("PayPal render error", error);
      });
    });
  }, [paypalReady, reload, sh, user]);

  const slotLimit = user ? getListingSlotLimit(user.id, slotPurchases, dbExtraSlots) : BASE_LISTING_SLOT_LIMIT;
  const slotBonus = getListingSlotBonus(slotPurchases) + dbExtraSlots;
  const slotPercent = Math.min(100, Math.round((slotUsed / slotLimit) * 100));

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <Link className="back-link" href="/">
          <ArrowLeft size={18} />
          {t.back}
        </Link>
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

            <div className="rewards-card cash-shop-card">
              <div className="rewards-card-head">
                <CreditCard size={20} />
                <h2>{sh.cashTitle}</h2>
                <span className="rewards-points-badge">PayPal</span>
              </div>
              <p className="rewards-muted">{sh.cashDesc}</p>

              <div className="point-package-grid">
                {POINT_PACKAGES.map((pack) => (
                  <div key={pack.id} className="point-package-card">
                    <span>{pack.label}</span>
                    <strong>
                      <Coins size={20} />
                      {pack.points.toLocaleString("fi-FI")} p
                    </strong>
                    <p>{pack.displayPrice}</p>
                    {paypalClientId ? (
                      <div className="paypal-button-slot" id={`paypal-buttons-${pack.id}`} />
                    ) : (
                      <button type="button" disabled>
                        {sh.addPaypalId}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {paymentMessage && <div className="quest-toast slot-shop-toast">{paymentMessage}</div>}

              <div className="payment-ready-note">
                <ShieldCheck size={18} />
                <span>{sh.securityNote}</span>
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
