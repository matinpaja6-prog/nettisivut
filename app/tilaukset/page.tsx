"use client";
import UiText from "@/app/components/UiText";

import Link from "@/app/components/LocalizedLink";
import Image from "next/image";
import {
  AlertCircle,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  ImageIcon,
  MapPin,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getSafeAuthSession } from "@/lib/supabase";
import { useLanguage, type SupportedLocale } from "@/lib/i18n";
import MarketplaceResponsibilityNotice from "@/app/components/MarketplaceResponsibilityNotice";
import styles from "./orders.module.css";

type OrderFilter = "all" | "open" | "delivered";

type BuyerOrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  product_description_snapshot: string | null;
  image_url_snapshot: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  pickup_address_snapshot: string | null;
  pickup_instructions_snapshot: string | null;
  shipping_notes_snapshot: string | null;
};

type BuyerOrder = {
  id: string;
  checkout_group_id: string | null;
  order_number: string;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  shipping_method: "pickup" | "posti";
  shipping_price_cents: number;
  pickup_point_name: string | null;
  pickup_point_address: string | null;
  posti_tracking_code: string | null;
  posti_tracking_url: string | null;
  seller_name_snapshot: string;
  paid_at: string | null;
  created_at: string;
  order_items: BuyerOrderItem[];
};

type StatusInfo = {
  label: string;
  description: string;
  tone: "new" | "progress" | "moving" | "done" | "attention" | "cancelled";
  step: number;
};

const FINAL_PAYMENT_STATUSES = new Set(["refunded", "cancelled"]);

const INTL_LOCALES: Record<SupportedLocale, string> = { fi: "fi-FI", en: "en-GB", sv: "sv-SE", no: "nb-NO" };

function localizedMoney(cents: number, locale: SupportedLocale, currency = "EUR") {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function localizedOrderDate(value: string, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function localizedOrderDateTime(value: string, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusInfo(order: BuyerOrder): StatusInfo {
  if (order.payment_status === "pending") {
    return { label: "Maksu odottaa", description: "Maksua ei ole vielä vahvistettu.", tone: "new", step: 0 };
  }
  if (order.payment_status === "processing_error") {
    return { label: "Maksua käsitellään", description: "Tarkistamme maksun tilannetta.", tone: "attention", step: 0 };
  }
  if (order.payment_status === "refunded") {
    return { label: "Hyvitetty", description: "Tilauksen maksu on palautettu.", tone: "cancelled", step: 0 };
  }
  if (order.payment_status === "partially_refunded") {
    return { label: "Osittain hyvitetty", description: "Osa tilauksen maksusta on palautettu.", tone: "attention", step: 3 };
  }
  if (order.payment_status === "disputed") {
    return { label: "Selvitettävänä", description: "Tilauksen maksua selvitetään.", tone: "attention", step: 1 };
  }
  if (order.payment_status === "cancelled" || order.fulfillment_status === "cancelled") {
    return { label: "Peruttu", description: "Tilaus on peruttu.", tone: "cancelled", step: 0 };
  }

  const statuses: Record<string, StatusInfo> = {
    unfulfilled: { label: "Tilaus vastaanotettu", description: "Myyjä on saanut tilauksesi.", tone: "new", step: 0 },
    processing: { label: "Käsittelyssä", description: "Myyjä valmistelee tilaustasi.", tone: "progress", step: 1 },
    awaiting_tracking: { label: "Pakataan lähetystä", description: "Lähetys odottaa seurantatunnusta.", tone: "progress", step: 1 },
    ready_for_pickup: { label: "Valmis noudettavaksi", description: "Voit noutaa tilauksesi myyjältä.", tone: "moving", step: 2 },
    shipped: { label: "Lähetetty", description: "Tilauksesi on matkalla.", tone: "moving", step: 2 },
    completed: { label: "Toimitettu", description: "Tilaus on toimitettu loppuun.", tone: "done", step: 3 },
    attention: { label: "Vaatii huomiota", description: "Myyjä selvittää tilauksen tilannetta.", tone: "attention", step: 1 },
  };

  return statuses[order.fulfillment_status] ?? statuses.unfulfilled;
}

function isOrderOpen(order: BuyerOrder) {
  return order.fulfillment_status !== "completed"
    && order.fulfillment_status !== "cancelled"
    && !FINAL_PAYMENT_STATUSES.has(order.payment_status);
}

function deliverySummary(order: BuyerOrder) {
  if (order.shipping_method === "pickup") return "Nouto myyjältä";
  const carrier = "Posti";
  return order.pickup_point_name ? `${carrier} · ${order.pickup_point_name}` : `${carrier}-toimitus`;
}

function productSummary(order: BuyerOrder) {
  const count = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const first = order.order_items[0]?.product_name;
  if (!first) return `${count} tuotetta`;
  if (order.order_items.length === 1) return `${first} · ${count} kpl`;
  return `${first} + ${order.order_items.length - 1} muuta`;
}

export default function BuyerOrdersPage() {
  const { locale } = useLanguage();
  const money = (cents: number, currency = "EUR") => localizedMoney(cents, locale, currency);
  const orderDate = (value: string) => localizedOrderDate(value, locale);
  const orderDateTime = (value: string) => localizedOrderDateTime(value, locale);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const session = await getSafeAuthSession();
      if (!session) throw new Error("Kirjaudu sisään nähdäksesi omat tilauksesi.");

      const response = await fetch("/api/commerce/buyer-orders", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json().catch(() => ({})) as { orders?: BuyerOrder[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Tilausten lataaminen epäonnistui.");

      setOrders((body.orders ?? []).map((order) => ({
        ...order,
        order_items: Array.isArray(order.order_items) ? order.order_items : [],
      })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tilausten lataaminen epäonnistui.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const openCount = useMemo(() => orders.filter(isOrderOpen).length, [orders]);
  const deliveredCount = useMemo(
    () => orders.filter((order) => order.fulfillment_status === "completed").length,
    [orders],
  );
  const filteredOrders = useMemo(() => {
    if (filter === "open") return orders.filter(isOrderOpen);
    if (filter === "delivered") return orders.filter((order) => order.fulfillment_status === "completed");
    return orders;
  }, [filter, orders]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroIcon}><ShoppingBag size={30} aria-hidden="true" /></div>
          <div>
            <span className={styles.eyebrow}><UiText text={"Oma asiakastili"} /></span>
            <h1><UiText text={"Kaikki tilaukset"} /></h1>
            <p><UiText text={"Seuraa ostamiesi tuotteiden käsittelyä, toimitusta ja noutovalmiutta yhdestä paikasta."} /></p>
          </div>
          {!loading && orders.length > 0 ? (
            <div className={styles.heroTotal}>
              <strong>{orders.length}</strong>
              <span>{orders.length === 1 ? "tilaus" : "tilausta"}</span>
            </div>
          ) : null}
        </header>

        <MarketplaceResponsibilityNotice compact />

        <nav className={styles.filters} aria-label="Suodata tilauksia">
          <button type="button" className={filter === "all" ? styles.filterActive : styles.filter} onClick={() => setFilter("all")}><UiText text={"Kaikki "} /><span>{orders.length}</span>
          </button>
          <button type="button" className={filter === "open" ? styles.filterActive : styles.filter} onClick={() => setFilter("open")}>
            <Clock3 size={16} /><UiText text={" Käsittelyssä "} /><span>{openCount}</span>
          </button>
          <button type="button" className={filter === "delivered" ? styles.filterActive : styles.filter} onClick={() => setFilter("delivered")}>
            <CheckCircle2 size={16} /><UiText text={" Toimitettu "} /><span>{deliveredCount}</span>
          </button>
        </nav>

        {loading ? (
          <section className={styles.stateCard} aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <div><strong><UiText text={"Haetaan tilauksiasi"} /></strong><p><UiText text={"Tämä kestää tavallisesti vain hetken."} /></p></div>
          </section>
        ) : null}

        {!loading && error ? (
          <section className={styles.stateCard} role="alert">
            <span className={styles.stateIconError}><AlertCircle size={27} /></span>
            <div><strong><UiText text={"Tilausten lataaminen epäonnistui"} /></strong><p>{error}</p></div>
            <button type="button" className={styles.retryButton} onClick={() => void loadOrders()}><RotateCcw size={16} /><UiText text={" Yritä uudelleen"} /></button>
          </section>
        ) : null}

        {!loading && !error && orders.length === 0 ? (
          <section className={styles.emptyState}>
            <span><PackageCheck size={34} /></span>
            <h2><UiText text={"Ei vielä tilauksia"} /></h2>
            <p><UiText text={"Kun ostat Maskinesin yrityskaupoista, tilauksesi ja niiden eteneminen näkyvät täällä."} /></p>
            <Link href="/kauppa"><UiText text={"Tutustu tuotteisiin"} /></Link>
          </section>
        ) : null}

        {!loading && !error && orders.length > 0 ? (
          <section className={styles.ordersPanel}>
            <div className={styles.tableHeader} aria-hidden="true">
              <span><UiText text={"Tilaus"} /></span><span><UiText text={"Tilauspäivä"} /></span><span><UiText text={"Tiedot"} /></span><span><UiText text={"Tila"} /></span><span><UiText text={"Summa"} /></span><span />
            </div>

            <div className={styles.orderList}>
              {filteredOrders.map((order) => {
                const status = statusInfo(order);
                const expanded = expandedOrderId === order.id;
                const trackingUrl = order.posti_tracking_url
                  || (order.posti_tracking_code ? `https://www.posti.fi/fi/seuranta#/lahetys/${encodeURIComponent(order.posti_tracking_code)}` : "");
                const steps = order.shipping_method === "pickup"
                  ? ["Vahvistettu", "Käsittelyssä", "Noutovalmis", "Noudettu"]
                  : ["Vahvistettu", "Käsittelyssä", "Lähetetty", "Toimitettu"];
                const cancelled = status.tone === "cancelled";

                return (
                  <article className={`${styles.order} ${expanded ? styles.orderExpanded : ""}`} key={order.id}>
                    <button
                      type="button"
                      className={styles.orderRow}
                      aria-expanded={expanded}
                      aria-controls={`order-${order.id}`}
                      onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                    >
                      <strong className={styles.orderNumber}>{order.order_number}</strong>
                      <span className={styles.orderDate}>{orderDate(order.created_at)}</span>
                      <span className={styles.orderInfo}><strong>{order.seller_name_snapshot}</strong><small>{productSummary(order)} · {deliverySummary(order)}</small></span>
                      <span className={`${styles.status} ${styles[`status_${status.tone}`]}`}>{status.label}</span>
                      <strong className={styles.orderTotal}>{money(order.total_cents, order.currency)}</strong>
                      <ChevronDown className={styles.rowChevron} size={19} aria-hidden="true" />
                    </button>

                    {expanded ? (
                      <div className={styles.orderDetails} id={`order-${order.id}`}>
                        <div className={styles.detailTopline}>
                          <div><ReceiptText size={18} /><span><small><UiText text={"Tilaus tehty"} /></small><strong>{orderDateTime(order.created_at)}</strong></span></div>
                          <div><Box size={18} /><span><small><UiText text={"Myyjä"} /></small><strong>{order.seller_name_snapshot}</strong></span></div>
                          <div>{order.shipping_method === "posti" ? <Truck size={18} /> : <MapPin size={18} />}<span><small><UiText text={"Toimitustapa"} /></small><strong>{deliverySummary(order)}</strong></span></div>
                        </div>

                        {cancelled ? (
                          <div className={styles.cancelledNotice}><AlertCircle size={19} /><span><strong>{status.label}</strong><small>{status.description}</small></span></div>
                        ) : (
                          <div className={styles.progress} aria-label={`Tilauksen tila: ${status.label}`}>
                            {steps.map((step, index) => (
                              <div className={`${styles.progressStep} ${index <= status.step ? styles.progressReached : ""} ${index === status.step ? styles.progressCurrent : ""}`} key={step}>
                                <span>{index < status.step || status.step === 3 ? <Check size={15} /> : index + 1}</span>
                                <strong>{step}</strong>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className={styles.statusMessage}>
                          {status.tone === "done" ? <CheckCircle2 size={21} /> : status.tone === "attention" ? <AlertCircle size={21} /> : <Clock3 size={21} />}
                          <span><strong>{status.label}</strong><small>{status.description}</small></span>
                          {trackingUrl ? <a href={trackingUrl} target="_blank" rel="noreferrer nofollow"><UiText text={"Seuraa lähetystä "} /><ExternalLink size={14} /></a> : null}
                        </div>

                        <div className={styles.products}>
                          {order.order_items.map((item) => (
                            <div className={styles.product} key={item.id}>
                              <div className={styles.productImage}>
                                {item.image_url_snapshot ? <Image src={item.image_url_snapshot} alt="" width={58} height={56} unoptimized /> : <ImageIcon size={25} aria-hidden="true" />}
                              </div>
                              <div className={styles.productCopy}>
                                <strong>{item.product_name}</strong>
                                <small>{item.quantity}<UiText text={" kpl · "} />{money(item.unit_price_cents, order.currency)}<UiText text={" / kpl"} /></small>
                              </div>
                              <strong>{money(item.line_total_cents, order.currency)}</strong>
                            </div>
                          ))}
                        </div>

                        <footer className={styles.detailFooter}>
                          <div>
                            <span>{order.shipping_method === "posti" ? "Postin noutopiste" : "Noutopaikka"}</span>
                            <strong>{order.shipping_method !== "pickup" ? order.pickup_point_address || "Tarkista osoite tilausvahvistuksesta" : order.order_items[0]?.pickup_address_snapshot || "Sovi noudosta myyjän kanssa"}</strong>
                            {order.posti_tracking_code ? <small><UiText text={"Seurantatunnus: "} />{order.posti_tracking_code}</small> : null}
                          </div>
                          <div><span><UiText text={"Tilauksen summa"} /></span><strong>{money(order.total_cents, order.currency)}</strong><small>{order.shipping_price_cents ? `Sisältää toimituksen ${money(order.shipping_price_cents, order.currency)}` : "Ei toimitusmaksua"}</small></div>
                        </footer>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            {filteredOrders.length === 0 ? (
              <div className={styles.filterEmpty}><PackageCheck size={24} /><span><UiText text={"Tässä ryhmässä ei ole tilauksia."} /></span></div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
