"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Home,
  ImageIcon,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import styles from "@/app/commerce.module.css";
import { clearCart } from "@/lib/commerce/cart";
import type { Order } from "@/lib/commerce/types";
import { useLanguage, type SupportedLocale } from "@/lib/i18n";

const INTL_LOCALES: Record<SupportedLocale, string> = { fi: "fi-FI", en: "en-GB", sv: "sv-SE", no: "nb-NO" };

type EmbeddedCheckoutInstance = { mount: (selector: string | HTMLElement) => void; destroy: () => void };
type StripeBrowserClient = { initEmbeddedCheckout: (options: { fetchClientSecret: () => Promise<string> }) => Promise<EmbeddedCheckoutInstance> };

declare global {
  interface Window {
    Stripe?: (publishableKey: string, options?: { stripeAccount?: string }) => StripeBrowserClient;
  }
}

let stripeJsPromise: Promise<void> | null = null;

function loadStripeJs() {
  if (typeof window === "undefined" || window.Stripe) return Promise.resolve();
  if (stripeJsPromise) return stripeJsPromise;
  stripeJsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/clover/stripe.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Maksupalvelun lataaminen epäonnistui.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/clover/stripe.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Maksupalvelun lataaminen epäonnistui."));
    document.head.appendChild(script);
  });
  return stripeJsPromise;
}

function localizedMoney(cents: number, locale: SupportedLocale) {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function localizedOrderDate(value: string, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function OrderSuccessPage() {
  const { locale } = useLanguage();
  const money = (cents: number) => localizedMoney(cents, locale);
  const orderDate = (value: string) => localizedOrderDate(value, locale);
  const params = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkout, setCheckout] = useState<{ checkout_number?: string; payment_status?: string; total_cents?: number; product_total_cents?: number; discount_total_cents?: number; shipping_total_cents?: number; receipt_sent_at?: string | null; created_at?: string } | null>(null);
  const [paymentSession, setPaymentSession] = useState<{ status?: string | null; paymentStatus?: string; clientSecret?: string | null } | null>(null);
  const [paymentPublishableKey, setPaymentPublishableKey] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [error, setError] = useState("");
  const paymentMountRef = useRef<HTMLDivElement | null>(null);
  const embeddedCheckoutRef = useRef<EmbeddedCheckoutInstance | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Tilaustunniste puuttuu. Tarkista sähköpostiisi lähetetty tilausvahvistus.");
      return;
    }

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const retry = () => {
      if (attempts >= 15) return false;
      timer = setTimeout(load, 2000);
      return true;
    };
    const load = async () => {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/commerce/order-status?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        const body = await response.json();
        if (!response.ok) {
          if ((response.status >= 500 || response.status === 404) && retry()) return;
          throw new Error(body.error || "Tilauksen lataaminen epäonnistui.");
        }
        const nextOrder = body.order ?? body.orders?.[0] ?? null;
        if (!nextOrder) {
          if (retry()) return;
          throw new Error("Tilausta ei löytynyt. Tarkista sähköpostiisi lähetetty tilausvahvistus.");
        }
        setOrder(nextOrder);
        setOrders(body.orders?.length ? body.orders : [nextOrder]);
        setCheckout(body.checkout ?? null);
        setPaymentSession(body.paymentSession ?? null);
        setPaymentPublishableKey(body.publishableKey ?? "");
        setError("");
        if ((body.checkout?.payment_status ?? nextOrder.payment_status) === "paid") {
          clearCart();
          const responseOrders = body.orders?.length ? body.orders as Order[] : [nextOrder as Order];
          const notificationsComplete = body.checkout
            ? Boolean(body.checkout.receipt_sent_at) && responseOrders.every((entry) => Boolean(entry.seller_notified_at))
            : Boolean(nextOrder.receipt_sent_at && nextOrder.seller_notified_at);
          if (!notificationsComplete && retry()) return;
          return;
        }
        retry();
      } catch (reason) {
        if (!retry()) setError(reason instanceof Error ? reason.message : String(reason));
      }
    };

    void load();
    return () => clearTimeout(timer);
  }, [sessionId]);

  useEffect(() => {
    const clientSecret = paymentSession?.clientSecret;
    if (!showPayment || !clientSecret || !paymentPublishableKey || !paymentMountRef.current) return;
    let cancelled = false;
    void loadStripeJs().then(async () => {
      if (cancelled || !window.Stripe || !paymentMountRef.current) return;
      embeddedCheckoutRef.current?.destroy();
      const instance = await window.Stripe(paymentPublishableKey).initEmbeddedCheckout({
        fetchClientSecret: async () => clientSecret,
      });
      if (cancelled || !paymentMountRef.current) {
        instance.destroy();
        return;
      }
      embeddedCheckoutRef.current = instance;
      instance.mount(paymentMountRef.current);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Maksusivun avaaminen epäonnistui.");
    });
    return () => {
      cancelled = true;
      embeddedCheckoutRef.current?.destroy();
      embeddedCheckoutRef.current = null;
    };
  }, [paymentPublishableKey, paymentSession?.clientSecret, showPayment]);

  const isPaid = (checkout?.payment_status ?? order?.payment_status) === "paid";
  const isProcessingError = order?.payment_status === "processing_error";
  const canResumePayment = !isPaid && paymentSession?.status === "open" && paymentSession.paymentStatus === "unpaid" && Boolean(paymentSession.clientSecret && paymentPublishableKey);
  const allOrders = orders.length ? orders : order ? [order] : [];
  const discountTotal = checkout?.discount_total_cents ?? allOrders.reduce((sum, item) => sum + (item.discount_cents ?? 0), 0);
  const shippingTotal = checkout?.shipping_total_cents ?? allOrders.reduce((sum, item) => sum + item.shipping_price_cents, 0);
  const grandTotal = checkout?.total_cents ?? allOrders.reduce((sum, item) => sum + item.total_cents, 0);
  const productTotal = Math.max(0, grandTotal - shippingTotal + discountTotal);
  const notificationsComplete = Boolean(
    (checkout ? checkout.receipt_sent_at : order?.receipt_sent_at) &&
    allOrders.length > 0 &&
    allOrders.every((entry) => Boolean(entry.seller_notified_at)),
  );

  return (
    <main className={`${styles.page} ${styles.orderSuccessPage}`}>
      <div className={`${styles.shell} ${styles.orderSuccessShell}`}>
        {!order && !error ? (
          <section className={styles.orderSuccessLoading} aria-live="polite">
            <span className={styles.orderSuccessSpinner} aria-hidden="true" />
            <div>
              <strong>Haetaan tilaustasi</strong>
              <p>Tämä kestää tavallisesti vain hetken.</p>
            </div>
          </section>
        ) : null}

        {error && !order ? (
          <section className={styles.orderSuccessError}>
            <span><ReceiptText size={30} /></span>
            <div className={styles.eyebrow}>Tilausta ei voitu näyttää</div>
            <h1>Tarkista tilausvahvistuksesi</h1>
            <p>{error}</p>
            <Link className={styles.button} href="/">
              <Home size={17} /> Takaisin etusivulle
            </Link>
          </section>
        ) : null}

        {order ? (
          <>
            <section className={styles.orderSuccessHero}>
              <div className={isPaid ? styles.orderSuccessStatusIcon : styles.orderSuccessPendingIcon}>
                {isPaid ? <CheckCircle2 size={36} /> : <Clock3 size={34} />}
              </div>
              <div className={styles.orderSuccessHeroCopy}>
                <div className={styles.eyebrow}>
                  {isPaid ? "Tilaus on vahvistettu" : "Maksu kesken"}
                </div>
                <h1>{isPaid ? "Kiitos tilauksestasi!" : "Maksua ei ole vielä vahvistettu"}</h1>
                <p>
                  {isPaid
                    ? "Maksu onnistui ja tilauksesi on välitetty myyjälle käsiteltäväksi."
                    : "Maksu jäi kesken tai palauduit maksupalvelusta. Tilausta ei ole välitetty myyjälle ennen onnistunutta maksua."}
                </p>
              </div>
              <div className={styles.orderSuccessOrderMeta}>
                <span>Tilausnumero</span>
                <strong>{checkout?.checkout_number ?? order.order_number}</strong>
                <small>{orderDate(checkout?.created_at ?? order.created_at)}</small>
              </div>
            </section>

            {!isPaid ? (
              <section className={styles.orderSuccessAttention}>
                <CreditCard size={20} />
                <div>
                  <strong>{canResumePayment ? "Viimeistele maksu" : "Maksua ei ole vastaanotettu"}</strong>
                  <p>{canResumePayment ? "Voit palata samaan maksuun ja valita maksutavan uudelleen." : "Avoin maksusessio ei ole enää käytettävissä. Palaa ostoskoriin ja aloita maksu uudelleen."}</p>
                </div>
                {canResumePayment ? (
                  <button className={styles.button} type="button" onClick={() => setShowPayment(true)}>
                    <CreditCard size={17} /> Palaa maksamaan
                  </button>
                ) : (
                  <Link className={styles.button} href="/ostoskori"><CreditCard size={17} /> Takaisin ostoskoriin</Link>
                )}
              </section>
            ) : null}

            {!isPaid && showPayment && canResumePayment ? (
              <section className={styles.maskinesPaymentShell}>
                <div className={styles.maskinesPaymentHeader}><div className={styles.maskinesPaymentMark}><span>M</span></div><div><strong>Jatka Maskines Pay -maksua</strong><small>Valitse maksutapa uudelleen</small></div><span><ShieldCheck size={16} /> Suojattu</span></div>
                <div className={styles.embeddedCheckoutWrap}><div ref={paymentMountRef} className={styles.embeddedCheckout} /></div>
              </section>
            ) : null}

            {isProcessingError ? (
              <div className={styles.orderSuccessAttention}>
                <Clock3 size={20} />
                <div>
                  <strong>Tilauksesi on vastaanotettu</strong>
                  <p>Käsittelemme tilausta parhaillaan. Otamme sinuun yhteyttä, jos tarvitsemme lisätietoja.</p>
                </div>
              </div>
            ) : null}

            <div className={styles.orderSuccessLayout}>
              <section className={styles.orderSuccessProducts}>
                <header>
                  <div>
                    <span className={styles.orderSuccessSectionIcon}><PackageCheck size={20} /></span>
                    <div>
                      <h2>{isPaid ? "Ostamasi tuotteet" : "Maksua odottavat tuotteet"}</h2>
                      <p>{allOrders.reduce((sum, entry) => sum + (entry.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) ?? 0), 0)} tuotetta · {allOrders.length} {allOrders.length === 1 ? "myyjä" : "myyjää"}</p>
                    </div>
                  </div>
                </header>

                <div className={styles.orderSuccessProductList}>
                  {allOrders.map((sellerOrder) => <section className={styles.orderSuccessSellerGroup} key={sellerOrder.id}><header><ShieldCheck size={17} /><span><small>Myyjä</small><strong>{sellerOrder.seller_name_snapshot}</strong></span><em>{sellerOrder.order_number}</em></header>{sellerOrder.order_items?.map((item) => (
                    <article className={styles.orderSuccessProduct} key={item.id ?? item.product_name}>
                      <div className={styles.orderSuccessProductImage}>
                        {item.image_url_snapshot ? (
                          <img src={item.image_url_snapshot} alt="" />
                        ) : (
                          <ImageIcon size={28} aria-hidden="true" />
                        )}
                      </div>
                      <div className={styles.orderSuccessProductCopy}>
                        <strong>{item.product_name}</strong>
                        {item.product_description_snapshot ? <p>{item.product_description_snapshot}</p> : null}
                        <span>{money(item.unit_price_cents)} / kpl</span>
                      </div>
                      <div className={styles.orderSuccessProductTotal}>
                        <span>{item.quantity} kpl</span>
                        <strong>{money(item.line_total_cents)}</strong>
                      </div>
                    </article>
                  ))}<footer><span>{sellerOrder.shipping_method !== "pickup" ? `Toimitus · ${sellerOrder.pickup_point_name ?? "noutopiste"}` : "Nouto myyjältä"}</span><strong>{money(sellerOrder.total_cents)}</strong></footer></section>)}
                </div>

                {isPaid ? <div className={styles.orderSuccessSeller}>
                  <ShieldCheck size={19} />
                  <span>Maksu on vastaanotettu turvallisesti Stripen kautta ja tilaus on välitetty {allOrders.length} myyjälle</span>
                </div> : <div className={styles.orderSuccessAttention}>
                  <Clock3 size={19} />
                  <span>Maksua ei ole vastaanotettu eikä tilausta ole välitetty myyjälle.</span>
                </div>}
              </section>

              <aside className={styles.orderSuccessSummary}>
                <div className={styles.orderSuccessSummaryTitle}>
                  <ReceiptText size={21} />
                  <h2>Tilauksen yhteenveto</h2>
                </div>
                <div className={styles.orderSuccessTotals}>
                  <p><span>Tuotteet</span><strong>{money(productTotal)}</strong></p>
                  {discountTotal > 0 && <p><span>Alennukset</span><strong>−{money(discountTotal)}</strong></p>}
                  <p><span>Toimitukset</span><strong>{shippingTotal ? money(shippingTotal) : "0,00 €"}</strong></p>
                </div>
                <div className={styles.orderSuccessGrandTotal}>
                  <span>Yhteensä</span>
                  <strong>{money(grandTotal)}</strong>
                  <small>{isPaid ? "Lopullinen maksettu summa" : "Maksettava summa"}</small>
                </div>

                {allOrders.map((sellerOrder) => <div className={styles.orderSuccessDelivery} key={sellerOrder.id}>
                  {sellerOrder.shipping_method !== "pickup" ? <Truck size={21} /> : <MapPin size={21} />}
                  <div><strong>{sellerOrder.seller_name_snapshot}</strong><span>{sellerOrder.shipping_method !== "pickup" ? `Posti · ${sellerOrder.pickup_point_name ?? "toimitus noutopisteeseen"}` : "Nouto myyjältä"}</span>{sellerOrder.pickup_point_address ? <small>{sellerOrder.pickup_point_address}</small> : null}</div>
                </div>)}

                <div className={styles.orderSuccessEmailNote}>
                  {notificationsComplete ? <Check size={18} /> : <Clock3 size={18} />}
                  <p>
                    {isPaid && notificationsComplete
                      ? "Tilausvahvistus ja kuitti on lähetetty sähköpostiisi."
                      : isPaid
                        ? "Tilausvahvistusta ja PDF-kuittia lähetetään. Pidä tämä sivu avoinna vielä hetki."
                      : "Tilausvahvistus ja kuitti lähetetään sähköpostiisi heti, kun maksu on vahvistettu."}
                  </p>
                </div>
              </aside>
            </div>

            <section className={styles.orderSuccessNext}>
              <div>
                <strong>{isPaid ? "Mitä tapahtuu seuraavaksi?" : "Maksu pitää viimeistellä"}</strong>
                <p>{isPaid ? "Jokainen myyjä käsittelee oman alitilauksensa. Saat yrityksiltä erilliset toimitus- ja noutoviestit." : "Myyjä saa tilauksen vasta onnistuneen maksun jälkeen."}</p>
              </div>
              <div>
                {isPaid ? <Link className={styles.buttonSecondary} href="/tilaukset">
                  <PackageCheck size={17} /> Omat tilaukset
                </Link> : null}
                <Link className={styles.buttonSecondary} href="/">
                  <Home size={17} /> Etusivulle
                </Link>
                {isPaid ? <Link className={styles.button} href="/ilmoitukset">
                  Jatka ostoksia <ArrowRight size={17} />
                </Link> : canResumePayment ? <button className={styles.button} type="button" onClick={() => setShowPayment(true)}><CreditCard size={17} /> Palaa maksamaan</button> : <Link className={styles.button} href="/ostoskori"><CreditCard size={17} /> Takaisin ostoskoriin</Link>}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
