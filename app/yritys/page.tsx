"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Globe2,
  ImageIcon,
  Languages,
  LayoutDashboard,
  ListChecks,
  MailCheck,
  Menu,
  Megaphone,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  Download,
  Search,
  Store,
  Tag,
  TicketPercent,
  Truck,
  ShieldCheck,
  WalletCards,
  X,
  XCircle
} from "lucide-react";

import styles from "@/app/commerce.module.css";
import {
  estimateCommerceFees,
  FEE_METHODS,
  grossUpCommercePrice,
  stripePaymentMethodLabel
} from "@/lib/commerce/fees";
import type { Company, CompanyDiscountCode, Order, Product, ProductDraft } from "@/lib/commerce/types";
import { VAT_RATE_OPTIONS, ZERO_VAT_RATE } from "@/lib/commerce/vat";
import { canPublishProduct, commerceStatusMessage, isStripeReady } from "@/lib/commerce/validation";
import { getProfile, getSafeAuthSession, supabase } from "@/lib/supabase";
import MaskinesWordmark from "@/app/components/MaskinesWordmark";
import { RETURN_LANGUAGES, type ReturnLanguage, type ReturnPolicy } from "@/lib/commerce/return-types";
import { profilePath } from "@/lib/routes";
import { useLanguage } from "@/lib/i18n";

type Tab = "overview" | "setup" | "profile" | "appearance" | "promo" | "products" | "discounts" | "orders" | "returns" | "shipping";
type OrderFilter = "all" | "open" | "new" | "processing" | "awaiting_tracking" | "ready" | "completed" | "pickup";
type BusinessReturn = { id: string; return_number: string; status: string; reason: string; description: string; tracking_code: string | null; refund_cents: number; deadline_at: string | null; created_at: string; order?: { order_number: string; customer_name: string; customer_email: string; currency: string; total_cents: number } };
const COMPANY_VERIFICATION_HREF = "/profile?verifyCompany=1#tilin-turvallisuus";
const RETURN_LANGUAGE_LABELS: Record<ReturnLanguage, string> = {
  en: "English",
  fi: "Suomi",
  sv: "Svenska",
  no: "Norsk"
};
const RETURN_SECTION_LABELS: Record<ReturnLanguage, Record<"instructions" | "conditions" | "packing" | "exclusions", string>> = {
  fi: { instructions: "14 päivän palautusoikeus", conditions: "Palautuksen ehdot", packing: "Pakkausohjeet", exclusions: "Tuotteet, joita ei voi palauttaa" },
  en: { instructions: "14-day right of return", conditions: "Return conditions", packing: "Packing instructions", exclusions: "Items excluded from returns" },
  sv: { instructions: "14 dagars returrätt", conditions: "Returvillkor", packing: "Förpackningsanvisningar", exclusions: "Produkter som inte kan returneras" },
  no: { instructions: "14 dagers angrerett", conditions: "Returvilkår", packing: "Pakkeinstruksjoner", exclusions: "Produkter som ikke kan returneres" }
};
const RETURN_META_LABELS: Record<ReturnLanguage, { businessId: string; email: string; phone: string; shipping: string; shippingMethod: string; shippingPayer: string; customer: string; seller: string; identifier: string; customerService: string }> = {
  fi: { businessId: "Y-tunnus", email: "Sähköposti", phone: "Puhelin", shipping: "Palautuksen toimitus", shippingMethod: "Toimitustapa", shippingPayer: "Palautuskulut maksaa", customer: "Asiakas", seller: "Myyjä", identifier: "Palautustunnus tai sopimusnumero", customerService: "Asiakaspalvelu" },
  en: { businessId: "Business ID", email: "Email", phone: "Phone", shipping: "Return shipment", shippingMethod: "Shipping method", shippingPayer: "Return shipping paid by", customer: "Customer", seller: "Seller", identifier: "Return or agreement number", customerService: "Customer service" },
  sv: { businessId: "FO-nummer", email: "E-post", phone: "Telefon", shipping: "Returleverans", shippingMethod: "Leveranssätt", shippingPayer: "Returfrakten betalas av", customer: "Kunden", seller: "Säljaren", identifier: "Retur- eller avtalsnummer", customerService: "Kundtjänst" },
  no: { businessId: "Organisasjonsnummer", email: "E-post", phone: "Telefon", shipping: "Returforsendelse", shippingMethod: "Forsendelsesmåte", shippingPayer: "Returfrakten betales av", customer: "Kunden", seller: "Selgeren", identifier: "Retur- eller avtalenummer", customerService: "Kundeservice" }
};
const RETURN_PREVIEW_ORDER_LABELS: Record<ReturnLanguage, { order: string; returnWithin: string; days: string }> = {
  fi: { order: "Tilaus", returnWithin: "Palautus", days: "päivän kuluessa" },
  en: { order: "Order", returnWithin: "Return within", days: "days" },
  sv: { order: "Beställning", returnWithin: "Returnera inom", days: "dagar" },
  no: { order: "Bestilling", returnWithin: "Returner innen", days: "dager" },
};

function returnPreviewText(policy: ReturnPolicy, language: ReturnLanguage, field: "instructions" | "conditions" | "packing" | "exclusions") {
  return policy.translations[language]?.[field]?.trim()
    || RETURN_LANGUAGES.map((candidate) => policy.translations[candidate]?.[field]?.trim()).find(Boolean)
    || "";
}

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  overview: { title: "Yrityksen hallinta", subtitle: "Kaikki yrityksesi tärkeimmät asiat yhdessä paikassa." },
  setup: { title: "Käyttöönotto", subtitle: "Ota yrityspaneeli haltuun vaihe vaiheelta ja tarkista, että myynti on valmis." },
  profile: { title: "Maksut ja myynti", subtitle: "Hallinnoi Stripe-maksuja, hinnoittelua ja myyntiasetuksia." },
  appearance: { title: "Sivun ulkoasu", subtitle: "Muokkaa yrityssivusi sisältöä, kuvia ja kategorioita." },
  promo: { title: "Mainosbanneri", subtitle: "Muokkaa yrityssivun kampanjapalkkia, tekstejä, väriä ja kuvaa." },
  products: { title: "Tuotteet ja ilmoitukset", subtitle: "Julkaise ja hallitse yrityksesi nykyisiä myynti-ilmoituksia." },
  discounts: { title: "Tarjoukset ja kampanjat", subtitle: "Luo, hallinnoi ja seuraa tarjouksia sekä kampanjoita." },
  orders: { title: "Tilaukset ja toimitukset", subtitle: "Seuraa tilausten käsittelyä ja toimitusten etenemistä." },
  returns: { title: "Palautukset ja palautusohjeet", subtitle: "Hallinnoi yrityksesi palautusehtoja, ohjeita ja tilauskohtaisia PDF-tiedostoja." },
  shipping: { title: "Toimitukset ja nouto", subtitle: "Valitse toimitusmaat, hinnat ja asiakkaalle lähetettävät nouto-ohjeet." }
};

const COMPANY_TABS = new Set<Tab>(["overview", "setup", "profile", "appearance", "promo", "products", "discounts", "orders", "returns", "shipping"]);

const SHIPPING_REGIONS = [
  { code: "FI", name: "Suomi", field: "default_shipping_price_fi_cents" },
  { code: "SE", name: "Ruotsi", field: "default_shipping_price_se_cents" },
  { code: "NO", name: "Norja", field: "default_shipping_price_no_cents" }
] as const;

function companyTabFromLocation(): Tab {
  if (typeof window === "undefined") return "overview";
  const requestedTab = new URLSearchParams(window.location.search).get("tab") as Tab | null;
  return requestedTab && COMPANY_TABS.has(requestedTab) ? requestedTab : "overview";
}

function companyTabHref(tab: Tab) {
  return tab === "overview" ? "/yritys" : `/yritys?tab=${tab}`;
}

const SHIPPING_STATUSES = [
  { id: "unfulfilled", label: "Uusi tilaus", description: "Tilausta ei ole vielä käsitelty." },
  { id: "processing", label: "Keräilyssä", description: "Tuotteita valmistellaan toimitukseen." },
  { id: "awaiting_tracking", label: "Odottaa seurantakoodia", description: "Paketti on valmisteltu, mutta seurantakoodi puuttuu." },
  { id: "shipped", label: "Lähetetty", description: "Seurantaviesti lähetetään ostajalle." },
  { id: "completed", label: "Valmis", description: "Tilaus on toimitettu loppuun." }
] as const;

const PICKUP_STATUSES = [
  { id: "unfulfilled", label: "Uusi tilaus", description: "Tilausta ei ole vielä käsitelty." },
  { id: "processing", label: "Valmistellaan", description: "Tuotteita valmistellaan noutoa varten." },
  { id: "ready_for_pickup", label: "Valmis noudettavaksi", description: "Ostajalle lähetetään noutoilmoitus." },
  { id: "completed", label: "Noudettu", description: "Ostaja on noutanut tilauksen." }
] as const;

function FulfillmentIcon({ status }: { status: string }) {
  if (status === "shipped") return <Truck size={18} />;
  if (status === "completed") return <CheckCircle2 size={18} />;
  if (status === "ready_for_pickup") return <PackageCheck size={18} />;
  if (status === "awaiting_tracking") return <Clock3 size={18} />;
  if (status === "attention") return <AlertTriangle size={18} />;
  if (status === "cancelled") return <XCircle size={18} />;
  if (status === "processing") return <PackagePlus size={18} />;
  return <Store size={18} />;
}

function fulfillmentLabel(status: string) {
  return [...SHIPPING_STATUSES, ...PICKUP_STATUSES].find((item) => item.id === status)?.label
    ?? (status === "attention" ? "Vaatii huomiota" : status === "cancelled" ? "Peruttu" : status);
}

function safeOrderWarning(value: string | null) {
  if (!value) return "";
  if (/no such destination|acct_[a-z0-9]+/i.test(value)) return "Tilitystili pitää yhdistää uudelleen. Asiakkaan maksu on vastaanotettu, mutta yrityksen Stripe Connect -tili ei ole enää voimassa.";
  return value.replace(/Error:\s*/gi, "").slice(0, 600);
}

const emptyProduct: ProductDraft = {
  name: "", description: "", storefront_category: null,
  price_cents: 0, seller_target_price_cents: null,
  sale_price_cents: null, sale_starts_at: null, sale_ends_at: null,
  vat_rate: ZERO_VAT_RATE, stock_quantity: 0,
  active: false, image_urls: [], pickup_available: true, pickup_address_override: null,
  pickup_instructions: null, shipping_available: false, posti_enabled: false,
  shipping_price_cents: null, shipping_price_fi_cents: null, shipping_price_se_cents: null, shipping_price_no_cents: null,
  free_shipping_threshold_cents: null, weight_grams: null,
  package_length_cm: null, package_width_cm: null, package_height_cm: null,
  max_shipping_quantity: 1, shipping_notes: null
};

function returnPolicyIsReady(policy: ReturnPolicy | null) {
  if (!policy?.enabled || !policy.recipient_name || !policy.address_line || !policy.postal_code || !policy.city || !policy.email) return false;
  return RETURN_LANGUAGES.some((language) => Boolean(policy.translations[language]?.instructions?.trim()));
}
function deliverySettingsAreReady(company: Company | null, policy: ReturnPolicy | null, product: Partial<Product | ProductDraft>) {
  if (!company || !returnPolicyIsReady(policy)) return false;
  if (product.pickup_available && !RETURN_LANGUAGES.every((language) => policy?.translations[language]?.pickup_instructions?.trim())) return false;
  if (product.shipping_available) {
    const countries = company.shipping_countries ?? [];
    const prices: Record<string, number | null> = { FI: company.default_shipping_price_fi_cents, SE: company.default_shipping_price_se_cents, NO: company.default_shipping_price_no_cents };
    if (!company.posti_enabled || countries.length === 0 || countries.some((country) => prices[country] == null)) return false;
  }
  return true;
}
function deliveryLabel(product: Product) {
  if (product.pickup_available && product.shipping_available && product.posti_enabled) return "Nouto + Posti";
  if (product.pickup_available) return "Nouto";
  return "Posti";
}

export default function CompanyDashboardPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const money = (cents: number) => new Intl.NumberFormat({ fi: "fi-FI", en: "en-GB", sv: "sv-SE", no: "nb-NO" }[locale], { style: "currency", currency: "EUR" }).format(cents / 100);
  const [token, setToken] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [discounts, setDiscounts] = useState<CompanyDiscountCode[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductDraft>(emptyProduct);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [feeCalculatorCents, setFeeCalculatorCents] = useState(10000);
  const [newStorefrontCategory, setNewStorefrontCategory] = useState("");
  const [freeShippingFeedback, setFreeShippingFeedback] = useState("");
  const [discountForm, setDiscountForm] = useState({ code: "", name: "", discount_type: "percent" as "percent" | "fixed", value: 10, minimum_order_euros: 0, maximum_uses: "", starts_at: "", expires_at: "", active: true });
  const [selectedSaleProductIds, setSelectedSaleProductIds] = useState<string[]>([]);
  const [bulkSaleForm, setBulkSaleForm] = useState({ percent: "10", starts: "", ends: "" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [returnPolicy, setReturnPolicy] = useState<ReturnPolicy | null>(null);
  const returnPolicyDirtyRef = useRef(false);
  const productDefaultVatKeyRef = useRef("");
  const [returnLanguage, setReturnLanguage] = useState<ReturnLanguage>("fi");
  const [returnSourceLanguage, setReturnSourceLanguage] = useState<ReturnLanguage>("fi");
  const [pickupSourceLanguage, setPickupSourceLanguage] = useState<ReturnLanguage>("fi");
  const [returns, setReturns] = useState<BusinessReturn[]>([]);

  const selectTab = useCallback((nextTab: Tab) => {
    setTab(nextTab);
    setError("");
    setMessage("");
    const nextHref = companyTabHref(nextTab);
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref !== nextHref) window.history.replaceState(window.history.state, "", nextHref);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const syncTabFromAddress = () => setTab(companyTabFromLocation());
    syncTabFromAddress();
    window.addEventListener("popstate", syncTabFromAddress);
    return () => window.removeEventListener("popstate", syncTabFromAddress);
  }, []);

  const api = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${token}`, ...init?.headers }
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Toiminto epäonnistui.");
    return body;
  }, [token]);

  useEffect(() => {
    getSafeAuthSession().then(async (session) => {
      if (!session) {
        setLoading(false);
        return;
      }
      const { data: ownProfile, error: profileError } = await getProfile(session.user.id);
      if (profileError || !ownProfile) {
        router.replace(COMPANY_VERIFICATION_HREF);
        return;
      }
      if (ownProfile.account_type !== "company") {
        router.replace("/profile#tiedot");
        return;
      }
      if (!ownProfile.company_verified_at) {
        router.replace(COMPANY_VERIFICATION_HREF);
        return;
      }
      setToken(session.access_token);
    }).catch((reason) => { setError(String(reason)); setLoading(false); });
  }, [router]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try {
      const companyBody = await api("/api/commerce/company");
      setCompany(companyBody.company);
      const [productResult, orderResult, discountResult, returnPolicyResult, returnsResult] = await Promise.allSettled([
        api("/api/commerce/products"), api("/api/commerce/orders"), api("/api/commerce/discounts"), api("/api/commerce/return-policy"), api("/api/commerce/returns")
      ]);
      if (productResult.status === "fulfilled") setProducts(productResult.value.products ?? []);
      if (orderResult.status === "fulfilled") setOrders(orderResult.value.orders ?? []);
      if (discountResult.status === "fulfilled") setDiscounts(discountResult.value.discounts ?? []);
      if (returnPolicyResult.status === "fulfilled" && !returnPolicyDirtyRef.current) {
        setReturnPolicy(returnPolicyResult.value.policy ?? null);
      }
      if (returnsResult.status === "fulfilled") setReturns(returnsResult.value.returns ?? []);
      // Alennusmigraatio voidaan ottaa käyttöön muun hallinnan jälkeen. Älä peitä
      // koko ohjauspaneelia virheilmoituksella, jos vain kampanjatiedot puuttuvat.
      const partialErrors = [productResult, orderResult]
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
      if (partialErrors.length) setError(`Yritysprofiili ladattiin, mutta osa myyntitiedoista puuttuu: ${partialErrors.join(" ")}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }, [api, token]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!company || editingId) return;
    const defaultVatKey = `${company.id}:${company.default_vat_rate}`;
    const shouldApplyDefaultVat = productDefaultVatKeyRef.current !== defaultVatKey;
    productDefaultVatKeyRef.current = defaultVatKey;
    setProductForm((current) => ({
      ...current,
      shipping_price_cents: current.shipping_price_cents ?? company.default_shipping_price_fi_cents,
      shipping_price_fi_cents: current.shipping_price_fi_cents ?? company.default_shipping_price_fi_cents,
      shipping_price_se_cents: current.shipping_price_se_cents ?? company.default_shipping_price_se_cents ?? company.default_shipping_price_fi_cents,
      shipping_price_no_cents: current.shipping_price_no_cents ?? company.default_shipping_price_no_cents ?? company.default_shipping_price_fi_cents,
      vat_rate: shouldApplyDefaultVat ? company.default_vat_rate : current.vat_rate
    }));
  }, [company, editingId]);

  const soldQuantity = useMemo(() => orders.filter((order) => order.payment_status === "paid").reduce((sum, order) => sum + (order.order_items ?? []).reduce((lineSum, item) => lineSum + item.quantity, 0), 0), [orders]);
  const paidOrders = useMemo(() => orders.filter((order) => order.payment_status === "paid"), [orders]);
  const monthlySalesCents = useMemo(() => {
    const now = new Date();
    return paidOrders
      .filter((order) => { const date = new Date(order.created_at); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); })
      .reduce((sum, order) => sum + order.total_cents, 0);
  }, [paidOrders]);
  const openOrdersCount = useMemo(() => orders.filter((order) => !new Set(["completed", "cancelled"]).has(order.fulfillment_status)).length, [orders]);
  const saleableProducts = useMemo(
    () => products.filter((product) => product.active && product.stock_quantity > 0),
    [products]
  );
  const managedProducts = useMemo(
    () => products.filter((product) => product.stock_quantity > 0),
    [products]
  );
  const lowStockCount = useMemo(() => saleableProducts.filter((product) => product.stock_quantity <= 2).length, [saleableProducts]);
  const payoutCents = useMemo(() => paidOrders.reduce((sum, order) => sum + Math.max(0, order.total_cents - order.maskines_fee_cents - (order.stripe_processing_fee_cents ?? 0)), 0), [paidOrders]);
  const salesChart = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const value = paidOrders.filter((order) => { const created = new Date(order.created_at); return created >= date && created < next; }).reduce((sum, order) => sum + order.total_cents, 0);
      return { label: date.toLocaleDateString("fi-FI", { weekday: "short" }), value };
    });
    const max = Math.max(...days.map((day) => day.value), 1);
    const points = days.map((day, index) => `${28 + index * 105},${184 - (day.value / max) * 142}`).join(" ");
    return { days, points };
  }, [paidOrders]);
  const discountProducts = saleableProducts;
  const discountedProducts = useMemo(() => discountProducts.filter((product) => product.sale_price_cents != null), [discountProducts]);
  useEffect(() => {
    const availableIds = new Set(discountProducts.map((product) => product.id));
    setSelectedSaleProductIds((current) => current.filter((id) => availableIds.has(id)));
  }, [discountProducts]);
  const setupChecklist = useMemo(() => [
    { id: "company", ready: company?.verification_status === "approved" },
    { id: "payments", ready: Boolean(company && isStripeReady(company)) },
    { id: "storefront", ready: Boolean(company?.storefront_headline || company?.banner_image_url || company?.storefront_categories.length) },
    { id: "listing", ready: managedProducts.length > 0 },
    { id: "delivery", ready: Boolean(company?.default_shipping_price_fi_cents != null || company?.pickup_email_message.trim()) }
  ], [company, managedProducts.length]);
  const setupReadyCount = setupChecklist.filter((item) => item.ready).length;
  const nextSetupStepIndex = setupChecklist.findIndex((item) => !item.ready);
  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (orderFilter === "all") return true;
    if (orderFilter === "open") return !new Set(["completed", "cancelled"]).has(order.fulfillment_status);
    if (orderFilter === "new") return order.fulfillment_status === "unfulfilled";
    if (orderFilter === "processing") return order.fulfillment_status === "processing";
    if (orderFilter === "ready") return new Set(["shipped", "ready_for_pickup"]).has(order.fulfillment_status);
    if (orderFilter === "completed") return order.fulfillment_status === "completed";
    if (orderFilter === "pickup") return order.shipping_method === "pickup";
    return order.fulfillment_status === orderFilter;
  }), [orderFilter, orders]);
  const awaitingTrackingCount = useMemo(() => orders.filter((order) => order.fulfillment_status === "awaiting_tracking").length, [orders]);
  const selectedFeeMethod = company?.fee_estimate_method ?? "card_standard";
  const calculatorPublicCents = company?.fee_pricing_strategy === "include"
    ? grossUpCommercePrice(feeCalculatorCents, selectedFeeMethod)
    : feeCalculatorCents;
  const productEntryCents = company?.fee_pricing_strategy === "include"
    ? (productForm.seller_target_price_cents ?? productForm.price_cents)
    : productForm.price_cents;
  const productPublicPriceCents = company?.fee_pricing_strategy === "include"
    ? grossUpCommercePrice(productEntryCents, selectedFeeMethod)
    : productEntryCents;
  const productFeePreview = estimateCommerceFees(productPublicPriceCents, selectedFeeMethod);

  async function saveCompany() {
    if (!company) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const body = await api("/api/commerce/company", { method: "PUT", body: JSON.stringify(company) });
      setCompany(body.company);
      if (body.company?.verification_status !== "approved") {
        router.replace(COMPANY_VERIFICATION_HREF);
        return;
      }
      setMessage(body.warning || "Yritystiedot tallennettiin.");
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }
  async function saveDeliverySettings() {
    if (!company) return;
    if (!company.pickup_email_message.trim()) { setError("Kirjoita nouto-ohje ennen toimitusasetusten tallentamista."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const companyBody = await api("/api/commerce/company", { method: "PUT", body: JSON.stringify(company) });
      setCompany(companyBody.company);
      const pickupBody = await api("/api/commerce/pickup-instructions", { method: "PUT", body: JSON.stringify({ message: company.pickup_email_message, source_language: pickupSourceLanguage }) });
      setReturnPolicy(pickupBody.policy);
      setMessage(pickupBody.warning || "Toimitusasetukset tallennettiin ja nouto-ohje käännettiin neljälle kielelle.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }
  async function saveFreeShipping() {
    if (!company) return;
    setSaving(true); setError(""); setMessage(""); setFreeShippingFeedback("");
    try {
      const body = await api("/api/commerce/company", { method: "PUT", body: JSON.stringify(company) });
      setCompany(body.company);
      const savedThreshold = body.company?.free_shipping_threshold_cents;
      setFreeShippingFeedback(savedThreshold == null
        ? "Ilmainen toimitus ei ole käytössä. Asiakkaalta veloitetaan normaali toimitusmaksu."
        : `Ilmainen toimitus on käytössä vähintään ${money(savedThreshold)} ostoksille.`);
      if (body.warning) setError(body.warning);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }
  async function connectStripe() {
    setSaving(true); setError("");
    try { const body = await api("/api/commerce/stripe/connect", { method: "POST", body: "{}" }); window.location.assign(body.url); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setSaving(false); }
  }
  async function refreshStripe() {
    setSaving(true); setError("");
    try { const body = await api("/api/commerce/stripe/status", { method: "POST", body: "{}" }); if (body.company) setCompany(body.company); setMessage(body.ready ? "Stripe-maksut ovat valmiina." : "Stripe tarvitsee vielä lisätietoja."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }

  async function uploadCompanyImage(kind: "banner" | "share" | "promo", files: FileList | null) {
    const file = files?.[0];
    if (!file || !company) return;
    const maxSizeMb = kind === "promo" ? 50 : 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Kuvan enimmäiskoko on ${maxSizeMb} Mt.`);
      return;
    }
    if (!supabase) {
      setError("Kuvapalvelun yhteys puuttuu.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const body = await api("/api/commerce/company/images", {
        method: "POST",
        body: JSON.stringify({ kind, type: file.type, size: file.size })
      });
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .uploadToSignedUrl(body.path, body.token, file, {
          contentType: file.type,
          cacheControl: "31536000"
        });
      if (uploadError) throw uploadError;
      const imageField = kind === "banner"
        ? "banner_image_url"
        : kind === "share"
          ? "social_share_image_url"
          : "storefront_promo_image_url";
      setCompany((current) => current ? { ...current, [imageField]: body.url } : current);
      setMessage("Kuva ladattiin. Tallenna vielä julkisen yrityssivun asetukset.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }

  function addStorefrontCategory() {
    if (!company) return;
    if (company.storefront_categories.length >= 6) {
      setError("Yrityssivulle voi lisätä enintään kuusi pääkategoriaa.");
      return;
    }
    const category = newStorefrontCategory.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!category || company.storefront_categories.some((item) => item.toLocaleLowerCase("fi-FI") === category.toLocaleLowerCase("fi-FI"))) return;
    setCompany({ ...company, storefront_categories: [...company.storefront_categories, category].slice(0, 6) });
    setNewStorefrontCategory("");
  }

  function editProduct(product?: Product) {
    setEditingId(product?.id ?? null);
    const estimatedExistingNet = product
      ? estimateCommerceFees(product.price_cents, company?.fee_estimate_method ?? "card_standard").sellerNetCents
      : 0;
    setProductForm(product ? {
      name: product.name, description: product.description, storefront_category: product.storefront_category,
      price_cents: product.price_cents,
      sale_price_cents: product.sale_price_cents ?? null,
      sale_starts_at: product.sale_starts_at ?? null,
      sale_ends_at: product.sale_ends_at ?? null,
      seller_target_price_cents: product.seller_target_price_cents ?? (
        company?.fee_pricing_strategy === "include" ? estimatedExistingNet : null
      ),
      vat_rate: Number(product.vat_rate), stock_quantity: product.stock_quantity, active: product.active,
      image_urls: product.image_urls ?? [], pickup_available: product.pickup_available,
      pickup_address_override: product.pickup_address_override, pickup_instructions: product.pickup_instructions,
      shipping_available: product.shipping_available, posti_enabled: product.posti_enabled,
      shipping_price_cents: product.shipping_price_fi_cents ?? product.shipping_price_cents,
      shipping_price_fi_cents: product.shipping_price_fi_cents ?? product.shipping_price_cents,
      shipping_price_se_cents: product.shipping_price_se_cents ?? product.shipping_price_fi_cents ?? product.shipping_price_cents,
      shipping_price_no_cents: product.shipping_price_no_cents ?? product.shipping_price_fi_cents ?? product.shipping_price_cents,
      free_shipping_threshold_cents: product.free_shipping_threshold_cents,
      weight_grams: product.weight_grams, package_length_cm: Number(product.package_length_cm) || null,
      package_width_cm: Number(product.package_width_cm) || null, package_height_cm: Number(product.package_height_cm) || null,
      max_shipping_quantity: product.max_shipping_quantity, shipping_notes: product.shipping_notes
    } : {
      ...emptyProduct,
      image_urls: [],
      seller_target_price_cents: null,
      shipping_price_cents: company?.default_shipping_price_fi_cents ?? null,
      shipping_price_fi_cents: company?.default_shipping_price_fi_cents ?? null,
      shipping_price_se_cents: company?.default_shipping_price_se_cents ?? company?.default_shipping_price_fi_cents ?? null,
      shipping_price_no_cents: company?.default_shipping_price_no_cents ?? company?.default_shipping_price_fi_cents ?? null,
      vat_rate: company?.default_vat_rate ?? ZERO_VAT_RATE
    });
    selectTab("products"); setMessage(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData(); Array.from(files).forEach((file) => form.append("images", file));
    setSaving(true); setError("");
    try { const body = await api("/api/commerce/products/images", { method: "POST", body: form }); setProductForm((current) => ({ ...current, image_urls: [...current.image_urls, ...(body.urls ?? [])].slice(0, 12) })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }
  async function saveProduct() {
    setSaving(true); setError(""); setMessage("");
    try {
      const body = await api(editingId ? `/api/commerce/products/${editingId}` : "/api/commerce/products", { method: editingId ? "PUT" : "POST", body: JSON.stringify(productForm) });
      setProducts((current) => editingId ? current.map((product) => product.id === editingId ? body.product : product) : [body.product, ...current]);
      setMessage(productForm.active ? "Tuote tallennettiin ja julkaistiin." : "Tuoteluonnos tallennettiin.");
      setEditingId(null);
      setProductForm({ ...emptyProduct, image_urls: [], seller_target_price_cents: null, vat_rate: company?.default_vat_rate ?? ZERO_VAT_RATE });
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }
  async function toggleProduct(product: Product) {
    const estimatedExistingNet = estimateCommerceFees(
      product.price_cents,
      company?.fee_estimate_method ?? "card_standard"
    ).sellerNetCents;
    const next = {
      ...productForm,
      ...product,
      seller_target_price_cents: product.seller_target_price_cents ?? (
        company?.fee_pricing_strategy === "include" ? estimatedExistingNet : null
      ),
      active: !product.active
    };
    setSaving(true); setError("");
    try { const body = await api(`/api/commerce/products/${product.id}`, { method: "PUT", body: JSON.stringify(next) }); setProducts((current) => current.map((candidate) => candidate.id === product.id ? body.product : candidate)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }
  async function updateOrder(order: Order, status: string, sendNotification = false) {
    if (status === "cancelled" && !window.confirm(`Perutaanko tilaus ${order.order_number}? Tätä toimintoa ei voi perua tästä näkymästä.`)) return;
    setError(""); setMessage("");
    try { const body = await api("/api/commerce/orders", { method: "PATCH", body: JSON.stringify({ id: order.id, fulfillment_status: status, posti_tracking_code: order.posti_tracking_code, posti_tracking_url: order.posti_tracking_url, shipping_label_url: order.shipping_label_url, send_notification: sendNotification }) }); setOrders((current) => current.map((item) => item.id === order.id ? body.order : item)); setMessage(body.warning || (body.maskinesMessageSent ? "Seurantakoodi lähetettiin ostajalle Maskines-viestinä ja sähköpostina." : body.notificationSent ? "Ostajalle lähetettiin automaattinen sähköposti." : "Tilauksen toimitustiedot tallennettiin.")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function saveReturnPolicy() {
    if (!returnPolicy) return; setSaving(true); setError(""); setMessage("");
    try { const body = await api("/api/commerce/return-policy", { method: "PUT", body: JSON.stringify({ ...returnPolicy, company_name: company?.name ?? returnPolicy.company_name, source_language: returnSourceLanguage }) }); setReturnPolicy(body.policy); returnPolicyDirtyRef.current = false; setReturnLanguage(returnSourceLanguage); setMessage(body.warning || "Palautusohjeet käännettiin suomeksi, englanniksi, ruotsiksi ja norjaksi sekä julkaistiin."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setSaving(false); }
  }

  function updateReturnPolicy(patch: Partial<ReturnPolicy>) {
    returnPolicyDirtyRef.current = true;
    setReturnPolicy((current) => current ? { ...current, ...patch } : current);
  }

  function updateReturnTranslation(field: "instructions" | "conditions" | "packing" | "exclusions", value: string) {
    returnPolicyDirtyRef.current = true;
    setReturnPolicy((current) => {
      if (!current) return current;
      return {
        ...current,
        translations: {
          ...current.translations,
          [returnSourceLanguage]: {
            ...current.translations[returnSourceLanguage],
            [field]: value,
          },
        },
      };
    });
  }

  function toggleShippingCountry(country: string) {
    if (!company) return;
    const selected = company.shipping_countries ?? ["FI"];
    const shipping_countries = selected.includes(country) ? selected.filter((item) => item !== country) : [...selected, country];
    setCompany({ ...company, shipping_countries });
  }

  async function downloadReturnPdf(order: Order) {
    setError(""); try { const response = await fetch(`/api/commerce/orders/return-pdf?id=${encodeURIComponent(order.id)}&lang=${returnLanguage}`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) { const body = await response.json(); throw new Error(body.error || "PDF:n lataaminen epäonnistui."); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `maskines-return-${order.order_number}.pdf`; link.click(); URL.revokeObjectURL(url); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function updateReturnStatus(item: BusinessReturn, status: string) {
    setSaving(true); setError(""); try { const body = await api("/api/commerce/returns", { method: "PATCH", body: JSON.stringify({ id: item.id, status }) }); setReturns((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...body.return } : entry)); setMessage(`Palautus ${item.return_number} päivitettiin.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setSaving(false); }
  }

  async function createDiscount() {
    setSaving(true); setError(""); setMessage("");
    try {
      const body = await api("/api/commerce/discounts", { method: "POST", body: JSON.stringify(discountForm) });
      setDiscounts((current) => [body.discount, ...current]);
      setDiscountForm({ code: "", name: "", discount_type: "percent", value: 10, minimum_order_euros: 0, maximum_uses: "", starts_at: "", expires_at: "", active: true });
      setMessage("Alennuskoodi luotiin ja on valmis käytettäväksi.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }

  async function toggleDiscount(discount: CompanyDiscountCode) {
    setSaving(true); setError("");
    try {
      const body = await api("/api/commerce/discounts", { method: "PATCH", body: JSON.stringify({ id: discount.id, active: !discount.active }) });
      setDiscounts((current) => current.map((item) => item.id === discount.id ? body.discount : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }

  async function deleteDiscount(id: string) {
    setSaving(true); setError("");
    try {
      await api(`/api/commerce/discounts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setDiscounts((current) => current.filter((item) => item.id !== id));
      setMessage("Alennuskoodi poistettiin.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }

  async function applyProductDiscount(productIds = selectedSaleProductIds, remove = false) {
    const percent = Number(bulkSaleForm.percent);
    if (!productIds.length) { setError("Valitse vähintään yksi tuote."); return; }
    if (!remove && (!Number.isFinite(percent) || percent <= 0 || percent >= 100)) { setError("Alennusprosentin pitää olla 1–99 %."); return; }
    setSaving(true); setError("");
    try {
      const body = await api("/api/commerce/product-discounts", { method: "PATCH", body: JSON.stringify({ product_ids: productIds, discount_percent: remove ? undefined : percent, sale_starts_at: bulkSaleForm.starts, sale_ends_at: bulkSaleForm.ends, remove }) });
      const updates = new Map<string, Product>((body.products ?? []).map((product: Product) => [product.id, product]));
      setProducts((current) => current.map((item) => updates.get(item.id) ?? item));
      setSelectedSaleProductIds([]);
      setMessage(remove ? `Alennus poistettiin ${productIds.length} tuotteelta.` : `${percent} % alennus tallennettiin ${productIds.length} tuotteelle.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }

  function submitDashboardSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = dashboardSearch.trim().toLocaleLowerCase("fi-FI");
    if (!query) return;
    const matchingOrder = orders.find((order) => [order.order_number, order.customer_name, order.customer_email].some((value) => value.toLocaleLowerCase("fi-FI").includes(query)));
    if (matchingOrder) {
      setExpandedOrderId(matchingOrder.id);
      selectTab("orders");
      return;
    }
    const matchingProduct = managedProducts.find((product) => product.name.toLocaleLowerCase("fi-FI").includes(query));
    if (matchingProduct) {
      selectTab("products");
      setMessage(`Ilmoitus ”${matchingProduct.name}” löytyi myynti-ilmoituksista.`);
      return;
    }
    setMessage(`Haulla ”${dashboardSearch.trim()}” ei löytynyt tilauksia tai ilmoituksia.`);
  }

  if (loading) return <main className={`${styles.page} ${styles.companyDashboardPage} ${styles.dashboardGate}`}><div className={styles.empty}>Ladataan yrityksen hallintapaneelia…</div></main>;
  if (!token) return <main className={`${styles.page} ${styles.companyDashboardPage} ${styles.dashboardGate}`}><div className={styles.shell}><section className={styles.panel}><h1>Kirjaudu yritystilille</h1><p>Yrityksen hallinta vaatii kirjautumisen yritystilille.</p><Link className={styles.button} href="/auth">Kirjaudu</Link></section></div></main>;

  return <main className={`${styles.page} ${styles.companyDashboardPage} ${styles.businessAdminPage}`}><div className={styles.businessAdminShell}>
    <aside className={`${styles.businessSidebar}${sidebarOpen ? ` ${styles.businessSidebarOpen}` : ""}`}>
      <div className={styles.businessSidebarHeader}>
        <Link href="/" className={styles.businessBrand} aria-label="Maskines etusivu"><Image src="/maskines-brand-mark-clean-v4.png" width={42} height={38} alt="" unoptimized /><MaskinesWordmark /></Link>
        <button type="button" aria-label="Sulje valikko" onClick={() => setSidebarOpen(false)}><X size={21} /></button>
      </div>
      <nav className={styles.businessNav} aria-label="Yrityshallinnan osiot">
        <span className={styles.businessNavLabel}>Kauppa</span>
        <button className={tab === "overview" ? styles.businessNavActive : styles.businessNavItem} onClick={() => { selectTab("overview"); setSidebarOpen(false); }}><LayoutDashboard size={19} /><span>Yleiskatsaus</span></button>
        <button className={tab === "products" ? styles.businessNavActive : styles.businessNavItem} onClick={() => { selectTab("products"); setSidebarOpen(false); }}><Boxes size={19} /><span>Ilmoitukset</span><em>{managedProducts.length}</em></button>
        <Link className={styles.businessNavItem} href="/sell"><PackagePlus size={19} /><span>Lisää ilmoitus</span></Link>
        <button className={tab === "orders" ? styles.businessNavActive : styles.businessNavItem} onClick={() => { selectTab("orders"); setSidebarOpen(false); }}><Truck size={19} /><span>Tilaukset</span>{openOrdersCount > 0 && <em>{openOrdersCount}</em>}</button>
        <button className={tab === "returns" ? styles.businessNavActive : styles.businessNavItem} onClick={() => { selectTab("returns"); setSidebarOpen(false); }}><RotateCcw size={19} /><span>Palautukset ja palautusohjeet</span></button>
        <button className={tab === "discounts" ? styles.businessNavActive : styles.businessNavItem} onClick={() => { selectTab("discounts"); setSidebarOpen(false); }}><TicketPercent size={19} /><span>Tarjoukset ja kampanjat</span></button>

        <span className={styles.businessNavLabel}>Talous ja kasvu</span>
        <button className={tab === "profile" ? styles.businessNavActive : styles.businessNavItem} onClick={() => { selectTab("profile"); setSidebarOpen(false); }}><WalletCards size={19} /><span>Maksut ja tilitykset</span></button>
        <button className={tab === "shipping" ? styles.businessNavActive : styles.businessNavItem} onClick={() => { selectTab("shipping"); setSidebarOpen(false); }}><Truck size={19} /><span>Toimitukset</span></button>
        <button className={tab === "promo" ? styles.businessNavActive : styles.businessNavItem} onClick={() => { selectTab("promo"); setSidebarOpen(false); }}><Megaphone size={19} /><span>Markkinointi</span></button>
      </nav>
      <div className={styles.businessSidebarAccount}><span>{company?.name?.slice(0, 1).toUpperCase() || "M"}</span><div><strong>{company?.name || "Yritystili"}</strong><small><BadgeCheck size={13} /> Vahvistettu yritys</small></div><ChevronRight size={17} /></div>
    </aside>
    {sidebarOpen && <button type="button" className={styles.businessSidebarBackdrop} aria-label="Sulje sivuvalikko" onClick={() => setSidebarOpen(false)} />}

    <div className={styles.businessWorkspace}>
      <header className={styles.businessTopbar}>
        <button type="button" className={styles.businessMenuButton} aria-label="Avaa sivuvalikko" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
        <form className={styles.businessSearch} role="search" onSubmit={submitDashboardSearch}><Search size={18} aria-hidden="true" /><input type="search" value={dashboardSearch} onChange={(event) => setDashboardSearch(event.target.value)} placeholder="Hae tilauksia, ilmoituksia tai asiakkaita" aria-label="Hae hallintapaneelista" autoComplete="off" spellCheck={false} /><button type="submit"><Search size={17} aria-hidden="true" /><span>Hae</span></button></form>
      </header>

      <div className={styles.businessContent}>
        <header className={styles.businessPageHeading}><div><p>Maskines Business Admin</p><h1>{TAB_META[tab].title}</h1><span>{TAB_META[tab].subtitle}</span></div><div>{company && <Link href={profilePath(company.owner_user_id, company.name, "fi")} className={styles.businessSecondaryButton}>Näytä kauppa</Link>}{tab !== "products" && <Link href="/sell" className={styles.businessPrimaryButton}><PackagePlus size={17} /> Lisää ilmoitus</Link>}</div></header>
      {error && <p className={styles.error}>{error}</p>}{message && <p className={styles.success}>{message}</p>}
      {company && company.verification_status !== "approved" && <div className={styles.warning}><strong>Yritystä ei ole vielä vahvistettu.</strong> Voit käyttää hallintaa ja muokata luonnoksia, mutta julkaiseminen ja maksujen vastaanottaminen avautuvat vasta vahvistuksen jälkeen. <Link href="/profile#tilin-turvallisuus">Avaa yrityksen vahvistus</Link></div>}
    {tab === "overview" && company && <div className={styles.businessOverview}>
      <section className={styles.businessWelcome}><div><p>Hyvää huomenta,</p><h2>{company.name}</h2><span><BadgeCheck size={17} /> Vahvistettu yritys</span><small>Yrityksen tiedot ja henkilöllisyys on tarkistettu.</small></div><div><Languages size={18} /><span><strong>Pohjoismainen kauppa</strong><small>Suomi · Ruotsi · Norja</small></span></div></section>

      <section className={styles.businessKpis}>
        <article><span><WalletCards size={20} /></span><div><small>Myynti tässä kuussa</small><strong>{money(monthlySalesCents)}</strong><em>Maksettujen tilausten summa</em></div></article>
        <article><span><Truck size={20} /></span><div><small>Tilaukset</small><strong>{orders.length}</strong><em>{openOrdersCount} käsiteltävänä</em></div></article>
        <article><span><Boxes size={20} /></span><div><small>Aktiiviset ilmoitukset</small><strong>{saleableProducts.length}</strong><em>{managedProducts.length} ilmoitusta yhteensä</em></div></article>
        <article><span><BarChart3 size={20} /></span><div><small>Keskimääräinen maksettu tilaus</small><strong>{money(paidOrders.length ? Math.round(paidOrders.reduce((sum, order) => sum + order.total_cents, 0) / paidOrders.length) : 0)}</strong><em>{paidOrders.length} maksettua tilausta</em></div></article>
      </section>

      <div className={styles.businessMainGrid}>
        <section className={styles.businessCard}><header><div><p>Viimeiset 7 päivää</p><h3>Myynti ja tilaukset</h3></div></header><div className={styles.businessChartSummary}><span><small>Kuukauden myynti</small><strong>{money(monthlySalesCents)}</strong></span><span><small>Maksetut tilaukset</small><strong>{paidOrders.length}</strong></span></div>{salesChart.days.some((day) => day.value > 0) ? <div className={styles.businessChart}><svg viewBox="0 0 686 220" role="img" aria-label="Myynti viimeisen seitsemän päivän aikana"><path d="M28 184H658M28 136H658M28 88H658M28 42H658" /><polyline points={salesChart.points} /><g>{salesChart.days.map((day, index) => <circle key={day.label} cx={28 + index * 105} cy={184 - (day.value / Math.max(...salesChart.days.map((item) => item.value), 1)) * 142} r="5" />)}</g></svg><div>{salesChart.days.map((day) => <span key={day.label}>{day.label}</span>)}</div></div> : <div className={styles.businessEmpty}><BarChart3 size={27} /><strong>Ei myyntiä tällä ajalla</strong><span>Kaavio muodostuu maksetuista tilauksista.</span></div>}</section>

        <aside className={`${styles.businessCard} ${styles.businessTasks}`}><header><div><p>Työjono</p><h3>Vaatii huomiota</h3></div><span>{openOrdersCount + lowStockCount}</span></header><button onClick={() => selectTab("orders")}><span><Truck size={18} /></span><div><strong>{openOrdersCount} tilausta odottaa käsittelyä</strong><small>Avaa tilaukset ja päivitä toimitustila</small></div><ChevronRight size={17} /></button><button onClick={() => selectTab("products")}><span><AlertTriangle size={18} /></span><div><strong>{lowStockCount} ilmoitusta vaatii päivityksen</strong><small>Tarkista saldo ja tuotetiedot</small></div><ChevronRight size={17} /></button><button onClick={() => selectTab("returns")}><span><RotateCcw size={18} /></span><div><strong>Palautusohjeet</strong><small>Tarkista yrityksen ehdot ja PDF</small></div><ChevronRight size={17} /></button></aside>
      </div>

      <section className={`${styles.businessCard} ${styles.businessOrdersTable}`}><header><div><p>Tilaukset</p><h3>Uusimmat tilaukset</h3></div><button onClick={() => selectTab("orders")}>Näytä kaikki <ArrowRight size={15} /></button></header>{orders.length === 0 ? <div className={styles.businessEmpty}><PackageCheck size={27} /><strong>Ei vielä tilauksia</strong><span>Uudet maksetut tilaukset näkyvät tässä.</span></div> : <div className={styles.businessTableScroll}><table><thead><tr><th>Tilaus</th><th>Asiakas</th><th>Tuote</th><th>Maa</th><th>Summa</th><th>Maksu</th><th>Toimitus</th><th>Päivämäärä</th><th /></tr></thead><tbody>{orders.slice(0, 5).map((order) => { const country = (order.customer_country || "FI").toLowerCase(); return <tr key={order.id}><td><strong>{order.order_number}</strong></td><td>{order.customer_name}</td><td>{order.order_items?.[0]?.product_name || "Tilaus"}</td><td><span className={styles.businessCountry}><img src={`https://flagcdn.com/24x18/${country}.png`} alt="" />{country.toUpperCase()}</span></td><td><strong>{money(order.total_cents)}</strong></td><td><span className={order.payment_status === "paid" ? styles.businessStatusPaid : styles.businessStatusPending}>{order.payment_status === "paid" ? "Maksettu" : order.payment_status}</span></td><td><span className={styles.businessStatusNeutral}>{fulfillmentLabel(order.fulfillment_status)}</span></td><td>{new Date(order.created_at).toLocaleDateString("fi-FI")}</td><td><button aria-label={`Avaa tilaus ${order.order_number}`} onClick={() => { setExpandedOrderId(order.id); selectTab("orders"); }}><ChevronRight size={17} /></button></td></tr>; })}</tbody></table></div>}</section>

      <div className={styles.businessLowerGrid}>
        <section className={`${styles.businessCard} ${styles.businessListings}`}><header><div><p>Valikoima</p><h3>Ilmoitusten ja varaston tila</h3></div><button onClick={() => selectTab("products")}>Hallitse ilmoituksia <ArrowRight size={15} /></button></header>{saleableProducts.length === 0 ? <div className={styles.businessEmpty}><Boxes size={27} /><strong>Ei julkaistuja tuotteita</strong><span>Julkaise tuote, jolla on varastoa.</span></div> : <div>{saleableProducts.slice(0, 4).map((product) => <article key={product.id}>{product.image_urls?.[0] ? <Image src={product.image_urls[0]} width={62} height={52} alt="" unoptimized /> : <span className={styles.businessProductPlaceholder}><Boxes size={20} /></span>}<div><strong>{product.name}</strong><small>{money(product.price_cents)} · saldo {product.stock_quantity} kpl</small></div><span className={styles.businessStatusPaid}>Julkaistu</span></article>)}</div>}</section>

        <div className={styles.businessSideStack}>
          <section className={`${styles.businessCard} ${styles.businessPayout}`}><header><div><p>Maksut</p><h3>Maksettujen tilausten netto</h3></div><CreditCard size={22} /></header><strong>{money(payoutCents)}</strong><span>Myynti vähennettynä tallennetuilla Maskines- ja Stripe-kuluilla</span><small>Katso Stripe-tilin ajantasainen tilitysaikataulu maksuasetuksista.</small><button onClick={() => selectTab("profile")}>Näytä maksuasetukset</button></section>
        </div>
      </div>

      <section className={styles.businessQuickActions}><header><p>Pikatoiminnot</p><h3>Hoida yleisimmät tehtävät</h3></header><div><Link href="/sell"><PackagePlus size={19} /><span>Lisää uusi ilmoitus</span></Link><button onClick={() => selectTab("discounts")}><TicketPercent size={19} /><span>Luo tarjous</span></button><button onClick={() => selectTab("orders")}><Truck size={19} /><span>Käsittele tilaukset</span></button><button onClick={() => selectTab("returns")}><RotateCcw size={19} /><span>Palautusohjeet</span></button><button onClick={() => selectTab("products")}><Boxes size={19} /><span>Hallitse varastoa</span></button></div></section>
    </div>}

    {tab === "setup" && company && <div className={styles.setupPage}>
      <section className={`${styles.panel} ${styles.setupHero}`}>
        <div className={styles.setupHeroCopy}>
          <span className={styles.setupHeroIcon}><BookOpen size={27} /></span>
          <div>
            <div className={styles.eyebrow}>Käyttöönotto</div>
            <h2>Aloita myynti kolmessa selkeässä vaiheessa</h2>
            <p>Tee tehtävät järjestyksessä. Valmiit kohdat merkitään automaattisesti, ja oikealla näkyy aina vain seuraava tarvittava tehtävä.</p>
          </div>
        </div>
        <div className={styles.setupProgressCard}>
          <span><strong>{Math.round((setupReadyCount / setupChecklist.length) * 100)} %</strong><small>{setupReadyCount} / {setupChecklist.length} tehtävää valmiina</small></span>
          <div className={styles.setupProgressTrack} role="progressbar" aria-label="Käyttöönoton edistyminen" aria-valuemin={0} aria-valuemax={setupChecklist.length} aria-valuenow={setupReadyCount}>
            <span style={{ width: `${(setupReadyCount / setupChecklist.length) * 100}%` }} />
          </div>
          <em>{setupReadyCount === setupChecklist.length ? "Perusasetukset ovat valmiina" : `${setupChecklist.length - setupReadyCount} tehtävää jäljellä`}</em>
        </div>
      </section>

      <div className={styles.setupMainGrid}>
        <section className={`${styles.panel} ${styles.setupRoadmap}`}>
          <div className={styles.sectionHeading}><div><div className={styles.eyebrow}>Tehtäväpolku</div><h2>Tee nämä järjestyksessä</h2><p className={styles.muted}>Avaa tehtävä, tee tarvittavat tiedot ja palaa tälle sivulle.</p></div><ListChecks size={29} /></div>

          <section className={styles.setupPhase}>
            <header className={styles.setupPhaseHeader}><span>1</span><div><strong>Perusta kauppa</strong><small>Yritystili, maksut ja julkinen sivu</small></div><em>{setupChecklist.slice(0, 3).filter((item) => item.ready).length} / 3 valmis</em></header>
            <div className={styles.setupTaskList}>
              <article className={setupChecklist[0]?.ready ? styles.setupTaskReady : styles.setupTask}>
                <span className={styles.setupTaskStatus}>{setupChecklist[0]?.ready ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}</span>
                <div><strong>Vahvista yritystili</strong><p>Tarkista yrityksen tiedot ja viimeistele vahvistus.</p></div>
                <Link href="/profile?verifyCompany=1#tilin-turvallisuus">Avaa <ArrowRight size={15} /></Link>
              </article>
              <article className={setupChecklist[1]?.ready ? styles.setupTaskReady : styles.setupTask}>
                <span className={styles.setupTaskStatus}>{setupChecklist[1]?.ready ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}</span>
                <div><strong>Yhdistä maksut</strong><p>Ota Stripe käyttöön maksuja ja tilityksiä varten.</p></div>
                <button type="button" onClick={() => selectTab("profile")}>Avaa <ArrowRight size={15} /></button>
              </article>
              <article className={setupChecklist[2]?.ready ? styles.setupTaskReady : styles.setupTask}>
                <span className={styles.setupTaskStatus}>{setupChecklist[2]?.ready ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}</span>
                <div><strong>Viimeistele yrityssivu</strong><p>Lisää esittely, banneri ja vähintään yksi kategoria.</p></div>
                <button type="button" onClick={() => selectTab("appearance")}>Avaa <ArrowRight size={15} /></button>
              </article>
            </div>
          </section>

          <section className={styles.setupPhase}>
            <header className={styles.setupPhaseHeader}><span>2</span><div><strong>Aloita myynti</strong><small>Ensimmäinen ilmoitus ja toimitustavat</small></div><em>{setupChecklist.slice(3, 5).filter((item) => item.ready).length} / 2 valmis</em></header>
            <div className={styles.setupTaskList}>
              <article className={setupChecklist[3]?.ready ? styles.setupTaskReady : styles.setupTask}>
                <span className={styles.setupTaskStatus}>{setupChecklist[3]?.ready ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}</span>
                <div><strong>Luo ensimmäinen ilmoitus</strong><p>Lisää tuotekuvat, hinta, varasto ja julkaise tai tallenna luonnos.</p></div>
                <Link href="/sell">Luo ilmoitus <ArrowRight size={15} /></Link>
              </article>
              <article className={setupChecklist[4]?.ready ? styles.setupTaskReady : styles.setupTask}>
                <span className={styles.setupTaskStatus}>{setupChecklist[4]?.ready ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}</span>
                <div><strong>Tarkista toimitusasetukset</strong><p>Valitse postikulut, nouto ja asiakkaalle lähtevä noutoviesti.</p></div>
                <button type="button" onClick={() => selectTab("profile")}>Avaa <ArrowRight size={15} /></button>
              </article>
            </div>
          </section>

          <section className={styles.setupPhase}>
            <header className={styles.setupPhaseHeader}><span>3</span><div><strong>Hoida myyntiä</strong><small>Tilaukset, viestit ja kampanjat</small></div><em>Jatkuva vaihe</em></header>
            <div className={styles.setupManageRow}>
              <button type="button" onClick={() => selectTab("orders")}><Truck size={20} /><span><strong>Käsittele tilaukset</strong><small>Keräily, seuranta ja nouto</small></span><ArrowRight size={16} /></button>
              <button type="button" onClick={() => selectTab("discounts")}><TicketPercent size={20} /><span><strong>Luo kampanjoita</strong><small>Alekoodit ja tuotealennukset</small></span><ArrowRight size={16} /></button>
            </div>
          </section>
        </section>

        <aside className={styles.setupSide}>
          <section className={styles.setupNextCard}>
            <div className={styles.setupNextBadge}>{nextSetupStepIndex === -1 ? <CheckCircle2 size={20} /> : <ArrowRight size={20} />}</div>
            <div className={styles.eyebrow}>{nextSetupStepIndex === -1 ? "Kaikki valmista" : "Seuraava tehtävä"}</div>
            <h2>{nextSetupStepIndex === 0 ? "Vahvista yritystili" : nextSetupStepIndex === 1 ? "Yhdistä maksut" : nextSetupStepIndex === 2 ? "Viimeistele yrityssivu" : nextSetupStepIndex === 3 ? "Luo ensimmäinen ilmoitus" : nextSetupStepIndex === 4 ? "Tarkista toimitusasetukset" : "Aloita ilmoitusten hallinta"}</h2>
            <p>{nextSetupStepIndex === 0 ? "Tarkista yrityksen tiedot, jotta julkaiseminen ja maksutoiminnot avautuvat." : nextSetupStepIndex === 1 ? "Viimeistele Stripe-yhdistäminen, jotta asiakkaat voivat maksaa ostoksensa." : nextSetupStepIndex === 2 ? "Lisää yrityssivulle esittely, kuva ja kategoriat ennen asiakkaiden ohjaamista sivulle." : nextSetupStepIndex === 3 ? "Lisää ensimmäinen tuote kuvineen, hintoineen ja varastotietoineen." : nextSetupStepIndex === 4 ? "Valitse toimitus- ja noutotavat ennen ensimmäistä tilausta." : "Perusasetukset ovat kunnossa. Voit nyt hallita ja julkaista ilmoituksia."}</p>
            {nextSetupStepIndex === 0 ? <Link className={styles.setupNextAction} href="/profile?verifyCompany=1#tilin-turvallisuus">Avaa yrityksen tiedot <ArrowRight size={17} /></Link>
              : nextSetupStepIndex === 1 ? <button className={styles.setupNextAction} type="button" onClick={() => selectTab("profile")}>Avaa maksut <ArrowRight size={17} /></button>
              : nextSetupStepIndex === 2 ? <button className={styles.setupNextAction} type="button" onClick={() => selectTab("appearance")}>Muokkaa yrityssivua <ArrowRight size={17} /></button>
              : nextSetupStepIndex === 3 ? <Link className={styles.setupNextAction} href="/sell">Luo ilmoitus <ArrowRight size={17} /></Link>
              : nextSetupStepIndex === 4 ? <button className={styles.setupNextAction} type="button" onClick={() => selectTab("profile")}>Avaa toimitusasetukset <ArrowRight size={17} /></button>
              : <button className={styles.setupNextAction} type="button" onClick={() => selectTab("products")}>Hallitse ilmoituksia <ArrowRight size={17} /></button>}
          </section>

          <section className={`${styles.panel} ${styles.setupOrderGuide}`}>
            <div className={styles.sectionHeading}><div><div className={styles.eyebrow}>Kun tilaus tulee</div><h2>Tilaus etenee näin</h2></div><Truck size={25} /></div>
            <ol>
              <li><span>1</span><div><strong>Asiakas maksaa</strong><p>Tilaus näkyy Tilaukset-osiossa.</p></div></li>
              <li><span>2</span><div><strong>Valmistele</strong><p>Kerää postitus tai tee nouto valmiiksi.</p></div></li>
              <li><span>3</span><div><strong>Lähetä tieto</strong><p>Lisää seuranta tai lähetä noutoviesti.</p></div></li>
              <li><span>4</span><div><strong>Merkitse valmiiksi</strong><p>Tilaus jää historiaan myöhempää tarkistusta varten.</p></div></li>
            </ol>
          </section>
        </aside>
      </div>

      <section className={`${styles.panel} ${styles.setupQuickLinks}`}>
        <div><div className={styles.eyebrow}>Pikavalinnat</div><h2>Siirry suoraan oikeaan paikkaan</h2></div>
        <nav aria-label="Yrityspaneelin pikavalinnat">
          <button type="button" onClick={() => selectTab("overview")}><LayoutDashboard size={19} /><span>Yhteenveto</span></button>
          <button type="button" onClick={() => selectTab("profile")}><CircleDollarSign size={19} /><span>Maksut ja myynti</span></button>
          <button type="button" onClick={() => selectTab("appearance")}><ImageIcon size={19} /><span>Sivun ulkoasu</span></button>
          <button type="button" onClick={() => selectTab("products")}><PackagePlus size={19} /><span>Ilmoitukset</span></button>
          <button type="button" onClick={() => selectTab("discounts")}><TicketPercent size={19} /><span>Alennukset</span></button>
          <button type="button" onClick={() => selectTab("orders")}><Truck size={19} /><span>Tilaukset</span></button>
        </nav>
      </section>

      <section className={styles.setupInfoStrip}>
        <ShieldCheck size={22} /><p><strong>Hyvä tietää:</strong> varastosaldo estää loppuneen tuotteen uuden myynnin, ja Maskines lähettää nouto- sekä seurantaviestit tallennettujen tilaustietojen perusteella.</p>
      </section>
    </div>}

    {tab === "appearance" && company && <section className={`${styles.panel} ${styles.appearanceManager}`}>
        <div className={styles.sectionHeading}><div><div className={styles.eyebrow}>Julkinen yrityssivu</div><h2>Muokkaa yrityssivua</h2><p className={styles.muted}>Muokkaa tekstit, kuvat ja kategoriat kolmessa selkeässä vaiheessa. Muutokset tulevat julkiselle yrityssivullesi tallennuksen jälkeen.</p></div><Link className={styles.buttonSecondary} href={profilePath(company.owner_user_id, company.name, "fi")}>Esikatsele profiilia</Link></div>

        <nav className={styles.appearanceSteps} aria-label="Yrityssivun muokkausvaiheet">
          <a href="#yrityssivun-tekstit"><span>1</span><FileText size={20} /><strong>Tekstit</strong><small>Otsikko ja esittely</small></a>
          <a href="#yrityssivun-kuvat"><span>2</span><ImageIcon size={20} /><strong>Kuvat ja ilme</strong><small>Banneri ja jakokuva</small></a>
          <a href="#yrityssivun-kategoriat"><span>3</span><Tag size={20} /><strong>Kategoriat</strong><small>Valikon kuusi paikkaa</small></a>
          <a href="#yrityssivun-toimitus"><span>4</span><Truck size={20} /><strong>Toimitus</strong><small>Hinnat ja nouto</small></a>
        </nav>

        <div className={styles.appearanceWorkspace}>
        <div className={styles.appearanceEditor}>
          <section className={styles.appearanceEditorSection} id="yrityssivun-tekstit">
            <header><span>1</span><div><h3>Sivun tekstit</h3><p>Kirjoita lyhyesti, mitä yritys myy ja miksi asiakkaan kannattaa asioida kanssanne.</p></div></header>
            <div className={`${styles.appearanceTextFields} ${styles.formGrid}`}>
              <label className={styles.fieldFull}><span>Valikoiman otsikko</span><input value={company.storefront_headline} maxLength={180} onChange={(event) => setCompany({ ...company, storefront_headline: event.target.value })} placeholder="Esim. Varaosat, koneet ja tarvikkeet suoraan varastostamme" /><small>{company.storefront_headline.length} / 180 merkkiä</small></label>
              <label className={styles.fieldFull}><span>Yrityksen esittelyteksti</span><textarea value={company.description} maxLength={3000} onChange={(event) => setCompany({ ...company, description: event.target.value })} placeholder="Kerro yrityksestä, valikoimasta, kokemuksesta ja palvelusta." /><small>{company.description.length} / 3000 merkkiä</small></label>
              <label className={styles.field}><span>Yrityksen nimi</span><input value={company.name} maxLength={160} onChange={(event) => setCompany({ ...company, name: event.target.value })} /></label>
              <label className={styles.field}><span>Y-tunnus</span><input value={company.business_id} maxLength={80} onChange={(event) => setCompany({ ...company, business_id: event.target.value })} /></label>
              <label className={styles.field}><span>Yhteyshenkilö</span><input value={company.contact_person} maxLength={160} onChange={(event) => setCompany({ ...company, contact_person: event.target.value })} /></label>
              <label className={styles.field}><span>Julkinen sähköposti</span><input type="email" value={company.email} maxLength={180} onChange={(event) => setCompany({ ...company, email: event.target.value })} /></label>
              <label className={styles.field}><span>Julkinen puhelinnumero</span><input value={company.phone} maxLength={40} onChange={(event) => setCompany({ ...company, phone: event.target.value })} /></label>
              <label className={styles.fieldFull}><span>Verkkosivusto</span><input type="url" value={company.website ?? ""} maxLength={240} onChange={(event) => setCompany({ ...company, website: event.target.value || null })} placeholder="https://yritys.fi" /></label>
              <label className={styles.fieldFull}><span>Julkinen käynti- tai nouto-osoite</span><input value={company.address_line} maxLength={180} onChange={(event) => setCompany({ ...company, address_line: event.target.value })} /></label>
              <label className={styles.field}><span>Postinumero</span><input value={company.postal_code} maxLength={40} onChange={(event) => setCompany({ ...company, postal_code: event.target.value })} /></label>
              <label className={styles.field}><span>Kaupunki</span><input value={company.city} maxLength={100} onChange={(event) => setCompany({ ...company, city: event.target.value })} /></label>
              <label className={styles.fieldFull}><span>Maa</span><select value={company.country} onChange={(event) => setCompany({ ...company, country: event.target.value })}><option value="FI">Suomi</option><option value="SE">Ruotsi</option><option value="NO">Norja</option><option value="EE">Viro</option></select><small>Yrityksen nimen tai Y-tunnuksen muuttaminen voi vaatia uuden vahvistuksen.</small></label>
            </div>
          </section>

          <section className={styles.appearanceEditorSection} id="yrityssivun-kuvat">
            <header><span>2</span><div><h3>Kuvat ja sivun ilme</h3><p>Banneri tekee profiilista tunnistettavan. Jakokuvaa käytetään, kun sivu jaetaan esimerkiksi viestissä.</p></div></header>
            <div className={styles.storefrontImages}>
              <div className={styles.storefrontImageCard}>
                <div className={styles.storefrontImagePreview}>{company.banner_image_url ? <Image src={company.banner_image_url} width={900} height={300} alt="Yrityssivun banneri" unoptimized /> : <span><ImageIcon size={25} /> Bannerikuva 3:1</span>}</div>
                <label className={styles.field}><span>Julkisen profiilin bannerikuva</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadCompanyImage("banner", event.target.files)} /></label>
                {company.banner_image_url && <button type="button" className={styles.buttonDanger} onClick={() => setCompany({ ...company, banner_image_url: null })}>Poista banneri</button>}
              </div>
              <div className={styles.storefrontImageCard}>
                <div className={`${styles.storefrontImagePreview} ${styles.storefrontSharePreview}`}>{company.social_share_image_url ? <Image src={company.social_share_image_url} width={1200} height={630} alt="Linkin jakokuva" unoptimized /> : <span><ImageIcon size={25} /> Jakokuva 1200 × 630</span>}</div>
                <label className={styles.field}><span>Kuva, joka näkyy kun yrityssivu jaetaan</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadCompanyImage("share", event.target.files)} /></label>
                {company.social_share_image_url && <button type="button" className={styles.buttonDanger} onClick={() => setCompany({ ...company, social_share_image_url: null })}>Poista jakokuva</button>}
              </div>
            </div>
          </section>

          <section className={styles.appearanceEditorSection} id="yrityssivun-kategoriat">
            <header><span>3</span><div><h3>Valikon kategoriat</h3><p>Nimeä enintään kuusi pääkategoriaa. Ne näkyvät asiakkaalle yrityssivun tuotevalikon yläpuolella.</p></div><em>{company.storefront_categories.length} / 6 käytössä</em></header>
            <div className={styles.categoryBuilder}><label className={styles.field}><span>Uuden kategorian nimi</span><input value={newStorefrontCategory} maxLength={80} disabled={company.storefront_categories.length >= 6} onChange={(event) => setNewStorefrontCategory(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addStorefrontCategory(); } }} placeholder="Esim. Moottorit" /></label><button type="button" className={styles.buttonSecondary} disabled={company.storefront_categories.length >= 6} onClick={addStorefrontCategory}>Lisää kategoria</button></div>
            <div className={styles.categorySlotGrid}>{Array.from({ length: 6 }, (_, index) => { const category = company.storefront_categories[index]; return <article className={category ? styles.categorySlotFilled : styles.categorySlotEmpty} key={category ?? `empty-${index}`}><span>{index + 1}</span><div><strong>{category || "Vapaa kategoriapaikka"}</strong><small>{category ? "Näkyy yrityssivun valikossa" : "Lisää nimi yllä olevasta kentästä"}</small></div>{category && <button type="button" aria-label={`Poista kategoria ${category}`} onClick={() => setCompany({ ...company, storefront_categories: company.storefront_categories.filter((item) => item !== category) })}>×</button>}</article>; })}</div>
          </section>

          <section className={styles.appearanceEditorSection} id="yrityssivun-toimitus">
            <header><span>4</span><div><h3>Toimitus ja nouto</h3><p>Nämä tiedot näkyvät yritysprofiilin Toimitus-välilehdellä ja niitä käytetään kassalla.</p></div></header>
            <div className={styles.formGrid}>
              <label className={styles.field}><span>Postikulun oletushinta Suomeen (€)</span><input type="number" min="0" step="0.01" value={company.default_shipping_price_fi_cents == null ? "" : company.default_shipping_price_fi_cents / 100} onChange={(event) => setCompany({ ...company, default_shipping_price_fi_cents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) })} placeholder="Tuotekohtainen" /></label>
              <label className={styles.field}><span>Postikulun oletushinta Ruotsiin (€)</span><input type="number" min="0" step="0.01" value={company.default_shipping_price_se_cents == null ? "" : company.default_shipping_price_se_cents / 100} onChange={(event) => setCompany({ ...company, default_shipping_price_se_cents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) })} placeholder="Ei käytössä" /></label>
              <label className={styles.field}><span>Ilmaisen toimituksen raja (€)</span><input type="number" min="0" step="0.01" value={company.free_shipping_threshold_cents == null ? "" : company.free_shipping_threshold_cents / 100} onChange={(event) => setCompany({ ...company, free_shipping_threshold_cents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) })} placeholder="Ei käytössä" /><small>Raja näkyy hillittynä toimitustiedoissa, ei suurena mainospalkkina.</small></label>
              <label className={styles.field}><span>Usean tuotteen postikulut</span><select value={company.shipping_price_strategy} onChange={(event) => setCompany({ ...company, shipping_price_strategy: event.target.value === "sum" ? "sum" : "max" })}><option value="max">Korkein toimituskulu</option><option value="sum">Laske toimituskulut yhteen</option></select></label>
              <div className={styles.fieldFull}><span>Nouto-ohje asiakkaalle</span><p className={styles.muted}>Nouto-ohje ja sen automaattiset käännökset hallitaan Toimitukset ja nouto -osiossa.</p><button type="button" className={styles.buttonSecondary} onClick={() => selectTab("shipping")}>Muokkaa nouto-ohjetta</button></div>
            </div>
          </section>
        </div>

        <aside className={styles.storefrontLivePreview}>
          <div className={styles.storefrontLivePreviewTitle}><strong>Esikatselu</strong><span>näin asiakkaat näkevät sivusi</span></div>
          <div className={styles.storefrontPreviewCanvas}>
            <div className={styles.storefrontPreviewBanner}>{company.banner_image_url ? <Image src={company.banner_image_url} width={900} height={300} alt="Yrityssivun banneri" unoptimized /> : <span><ImageIcon size={28} /> Bannerikuva</span>}</div>
            <div className={styles.storefrontPreviewIdentity}><span>{company.name?.slice(0, 1).toUpperCase() || "M"}</span><div><strong>{company.name}</strong><small>{company.storefront_headline || "Yrityksesi valikoima ja palvelut"}</small></div><CheckCircle2 size={19} /></div>
            <div className={styles.storefrontPreviewCategories}>{company.storefront_categories.slice(0, 3).map((category) => <span key={category}>{category}<ChevronRight size={13} /></span>)}</div>
            <div className={styles.storefrontPreviewSectionTitle}><strong>{company.storefront_categories[0] || "Tuotteet"}</strong><small>Näytä kaikki <ChevronRight size={13} /></small></div>
            {saleableProducts[0] ? <article className={styles.storefrontPreviewProduct}>{saleableProducts[0].image_urls?.[0] ? <Image src={saleableProducts[0].image_urls[0]} width={160} height={130} alt="" unoptimized /> : <span><PackagePlus size={25} /></span>}<div><strong>{saleableProducts[0].name}</strong><b>{money(saleableProducts[0].sale_price_cents ?? saleableProducts[0].price_cents)}</b><small>Varastossa</small></div><button type="button">Katso tuote</button></article> : <div className={styles.storefrontPreviewEmpty}><PackagePlus size={25} /><span>Julkaistu tuote näkyy tässä.</span></div>}
          </div>
        </aside>
        </div>

        <div className={styles.appearanceSaveBar}><span><CheckCircle2 size={18} /><span><strong>Valmis julkaistavaksi</strong><small>Esikatsele sivu tarvittaessa ennen tallennusta.</small></span></span><button className={styles.button} disabled={saving} onClick={saveCompany}>{saving ? "Tallennetaan…" : "Tallenna yrityssivu"}</button></div>
      </section>}

    {tab === "promo" && company && <section className={`${styles.panel} ${styles.promoBannerManager}`}>
      <div className={styles.sectionHeading}>
        <div><div className={styles.eyebrow}>Yrityssivun kampanja</div><h2>Mainosbannerin muokkaus</h2><p className={styles.muted}>Banneri näkyy yrityksen julkisella kauppasivulla profiilin ja tuotevalikon välissä.</p></div>
        <Link className={styles.buttonSecondary} href={profilePath(company.owner_user_id, company.name, "fi")}>Esikatsele yrityssivua</Link>
      </div>

      <div className={styles.promoBannerWorkspace}>
        <div className={styles.promoBannerEditor}>
          <div className={styles.promoBannerStatus}>
            <div><strong>Näytä mainosbanneri</strong><small>Voit piilottaa palkin poistamatta tallennettuja tekstejä tai kuvaa.</small></div>
            <div className={styles.promoBannerToggle} role="group" aria-label="Mainosbannerin tila">
              <button type="button" className={!company.storefront_promo_enabled ? styles.promoBannerToggleActive : ""} onClick={() => setCompany({ ...company, storefront_promo_enabled: false })}>Ei käytössä</button>
              <button type="button" className={company.storefront_promo_enabled ? styles.promoBannerToggleActive : ""} onClick={() => setCompany({ ...company, storefront_promo_enabled: true })}>Käytössä</button>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.fieldFull}><span>Bannerin pääteksti</span><input value={company.storefront_promo_title} maxLength={120} onChange={(event) => setCompany({ ...company, storefront_promo_title: event.target.value })} placeholder={`ILMAINEN TOIMITUS YLI ${company.free_shipping_threshold_cents ? money(company.free_shipping_threshold_cents) : "200 €"} OSTOKSIIN`} /><small>{company.storefront_promo_title.length} / 120 merkkiä</small></label>
            <label className={styles.fieldFull}><span>Bannerin alateksti</span><input value={company.storefront_promo_subtitle} maxLength={180} onChange={(event) => setCompany({ ...company, storefront_promo_subtitle: event.target.value })} placeholder="Toimitusetu lisätään automaattisesti kassalla" /><small>{company.storefront_promo_subtitle.length} / 180 merkkiä</small></label>
            <label className={styles.field}><span>Taustaväri</span><span className={styles.promoColorField}><input type="color" value={company.storefront_promo_background_color} onChange={(event) => setCompany({ ...company, storefront_promo_background_color: event.target.value })} /><input value={company.storefront_promo_background_color} maxLength={7} onChange={(event) => setCompany({ ...company, storefront_promo_background_color: event.target.value })} aria-label="Taustavärin HEX-arvo" /></span></label>
            <label className={styles.field}><span>Oma bannerikuva</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadCompanyImage("promo", event.target.files)} /><small>Suositus vähintään 1600 × 300 px, enintään 50 Mt.</small></label>
          </div>

          {company.storefront_promo_image_url && <button type="button" className={styles.buttonDanger} onClick={() => setCompany({ ...company, storefront_promo_image_url: null })}>Poista mainosbannerin kuva</button>}
        </div>

        <aside className={styles.promoBannerPreview}>
          <div><strong>Esikatselu</strong><small>{company.storefront_promo_enabled ? "Banneri on käytössä" : "Banneri on piilotettu"}</small></div>
          <div
            className={`${styles.promoBannerPreviewCanvas} ${!company.storefront_promo_enabled ? styles.promoBannerPreviewDisabled : ""}`}
            style={{
              backgroundColor: /^#[0-9a-f]{6}$/i.test(company.storefront_promo_background_color) ? company.storefront_promo_background_color : "#ff6500",
              backgroundImage: company.storefront_promo_image_url ? `linear-gradient(90deg, rgba(5,17,30,.58), rgba(5,17,30,.34)), url(${JSON.stringify(company.storefront_promo_image_url)})` : undefined
            }}
          >
            <span>
              {company.storefront_promo_title.trim() && <strong>{company.storefront_promo_title.trim()}</strong>}
              {company.storefront_promo_subtitle.trim() && <small>{company.storefront_promo_subtitle.trim()}</small>}
            </span>
          </div>
        </aside>
      </div>

      <div className={styles.appearanceSaveBar}><span><CheckCircle2 size={18} /><span><strong>Bannerin asetukset valmiina</strong><small>Tallenna muutokset, jotta ne näkyvät asiakkaille.</small></span></span><button className={styles.button} disabled={saving} onClick={saveCompany}>{saving ? "Tallennetaan…" : "Tallenna mainosbanneri"}</button></div>
    </section>}

    {tab === "profile" && company && <>
      <section className={`${styles.panel} ${styles.stripeConnectPanel}`}><div className={styles.row}><div><h2>Stripe Connect</h2><p className={styles.muted}>Maksujen vastaanotto ja tilitykset yhdessä turvallisessa yhteydessä.</p></div><span className={isStripeReady(company) ? styles.badge : styles.badgeOrange}>{isStripeReady(company) ? "Valmis vastaanottamaan maksuja" : "Ei valmis"}</span></div>
        <div className={styles.list}><div className={styles.listItem}><span className={company.stripe_details_submitted ? styles.statusReady : styles.statusBlocked} /> Tiedot lähetetty</div><div className={styles.listItem}><span className={company.stripe_charges_enabled ? styles.statusReady : styles.statusBlocked} /> Maksut käytössä</div><div className={styles.listItem}><span className={company.stripe_payouts_enabled ? styles.statusReady : styles.statusBlocked} /> Tilitykset käytössä</div></div>
        {company.stripe_requirements_due?.length > 0 && <p className={styles.warning}>Stripe tarvitsee lisätietoja: {company.stripe_requirements_due.join(", ")}</p>}
        <div className={styles.wrap} style={{ marginTop: 16 }}><button className={styles.button} disabled={saving || !new Set(["pending","approved"]).has(company.verification_status)} onClick={connectStripe}>{company.stripe_account_id ? "Jatka Stripe-onboardingia" : "Yhdistä Stripe-maksut"}</button>{company.stripe_account_id && <button className={styles.buttonSecondary} disabled={saving} onClick={refreshStripe}>Päivitä Stripe-tila</button>}</div>
      </section>
      <section className={`${styles.panel} ${styles.pricingPanel}`}>
        <div className={styles.sectionHeading}>
          <div>
            <div className={styles.eyebrow}>Myyjän asetukset</div>
            <h2>Hinnoittelu ja maksukulut</h2>
            <p className={styles.muted}>Valitse, syötätkö ostajalle näkyvän hinnan vai summan, jonka haluat itsellesi kulujen jälkeen.</p>
          </div>
          <span className={styles.badgeOrange}>Maskines 1 %</span>
        </div>

        <div className={styles.choiceGrid}>
          <button
            type="button"
            className={company.fee_pricing_strategy === "deduct" ? styles.choiceCardActive : styles.choiceCard}
            onClick={() => setCompany({ ...company, fee_pricing_strategy: "deduct" })}
          >
            <strong>Yritys maksaa palvelumaksun</strong>
            <span>Sinä maksat Stripe-maksut. Asiakas näkee vain asettamasi hinnan.</span>
          </button>
          <button
            type="button"
            className={company.fee_pricing_strategy === "include" ? styles.choiceCardActive : styles.choiceCard}
            onClick={() => setCompany({ ...company, fee_pricing_strategy: "include" })}
          >
            <strong>Ostaja maksaa kulut hinnan lisäksi</strong>
            <span>Asiakas maksaa hinnan lisäksi arvioidut maksunkäsittelykulut.</span>
          </button>
        </div>

        <label className={styles.field} style={{ marginTop: 20 }}>
          <span>Uusien ilmoitusten ALV-oletus</span>
          <select value={company.default_vat_rate} onChange={(event) => setCompany({ ...company, default_vat_rate: Number(event.target.value) })}>
            {VAT_RATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <small className={styles.muted}>Valinta asetetaan automaattisesti uusiin tavallisiin ja multi-ilmoituksiin. Se ei muuta jo julkaistuja tuotteita.</small>
        </label>

        <div className={styles.feeCalculator}>
          <div className={styles.feeCalculatorTop}>
            <label className={styles.field}>
              <span>{company.fee_pricing_strategy === "include" ? "Esimerkin tavoitesumma sinulle (€)" : "Esimerkin myyntihinta (€)"}</span>
              <input type="number" min="0" step="0.01" value={feeCalculatorCents / 100} onChange={(event) => setFeeCalculatorCents(Math.max(0, Math.round((Number(event.target.value) || 0) * 100)))} />
            </label>
            <div className={styles.feeResult}>
              <span>Ostajalle näkyvä hinta</span>
              <strong>{money(calculatorPublicCents)}</strong>
              <small>{company.fee_pricing_strategy === "include" ? `Laskettu perusteella: ${FEE_METHODS.find((method) => method.id === selectedFeeMethod)?.shortLabel}` : "Sama hinta näkyy ilmoituksessa ja kassalla"}</small>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Maksutapa</th><th>Stripe-arvio</th><th>Maskines</th><th>Kulut yhteensä</th><th>Sinulle jää</th></tr></thead>
              <tbody>{FEE_METHODS.map((method) => {
                const estimate = estimateCommerceFees(calculatorPublicCents, method.id);
                return <tr key={method.id}><td><strong>{method.shortLabel}</strong><small className={styles.tableNote}>{method.note}</small></td><td>{money(estimate.stripeFeeCents)}</td><td>{money(estimate.maskinesFeeCents)}</td><td>{money(estimate.totalFeeCents)}</td><td><strong>{money(estimate.sellerNetCents)}</strong></td></tr>;
              })}</tbody>
            </table>
          </div>
          <p className={styles.feeDisclaimer}>Arviot perustuvat Stripen Suomen julkiseen hinnastoon. Lopullinen Stripe-kulu määräytyy ostajan todellisen maksutavan ja kortin perusteella. Toteutunut kulu tallennetaan maksetulle tilaukselle. Ostajalle ei lisätä kassalla erillistä yllätysmaksua.</p>
        </div>
        <div className={styles.wrap} style={{ marginTop: 16 }}><button className={styles.button} disabled={saving} onClick={saveCompany}>Tallenna myyntiasetukset</button><a className={styles.buttonSecondary} href="https://stripe.com/en-fi/pricing/local-payment-methods" target="_blank" rel="noreferrer">Avaa Stripen hinnasto</a></div>
      </section>
    </>}

    {tab === "discounts" && company && <div className={styles.discountDashboard}>
      <section className={`${styles.panel} ${styles.discountHero}`}><div><div className={styles.eyebrow}>Myynnin työkalut</div><h2>Tarjoukset ja kampanjat</h2><p>Valitse tuotteet, määritä prosenttialennus ja julkaise kampanja kaikkiin ilmoitusnäkymiin.</p></div><div className={styles.discountHeroStats}><span><strong>{discounts.filter((item) => item.active).length}</strong>Aktiivista koodia</span><span><strong>{discountedProducts.length}</strong>Alennettua tuotetta</span><span className={company.free_shipping_threshold_cents == null ? styles.discountStatOff : styles.discountStatOn}><strong>{company.free_shipping_threshold_cents == null ? "Ei käytössä" : `Yli ${money(company.free_shipping_threshold_cents)}`}</strong>Ilmainen toimitus</span></div></section>

      <section className={`${styles.panel} ${styles.freeShippingPanel}`}>
        <span className={styles.freeShippingIcon}><Truck size={24} /></span>
        <div className={styles.freeShippingCopy}>
          <div className={styles.eyebrow}>Toimituskampanja</div>
          <h2>Ilmainen toimitus</h2>
          <p>{company.free_shipping_threshold_cents == null ? "Ei käytössä – asiakas maksaa tällä hetkellä normaalin toimitusmaksun." : `Käytössä – toimitus muuttuu ilmaiseksi, kun ostos on vähintään ${money(company.free_shipping_threshold_cents)}.`}</p>
        </div>
        <div className={styles.freeShippingControls}>
          <div className={styles.freeShippingToggle} role="group" aria-label="Ilmaisen toimituksen tila">
            <button type="button" className={company.free_shipping_threshold_cents == null ? styles.freeShippingToggleActive : ""} onClick={() => { setCompany({ ...company, free_shipping_threshold_cents: null }); setFreeShippingFeedback(""); }}>Ei käytössä</button>
            <button type="button" className={company.free_shipping_threshold_cents != null ? styles.freeShippingToggleActive : ""} onClick={() => { setCompany({ ...company, free_shipping_threshold_cents: company.free_shipping_threshold_cents ?? 20000 }); setFreeShippingFeedback(""); }}>Käytössä</button>
          </div>
          {company.free_shipping_threshold_cents != null && <label className={styles.field}>
            <span>Ilmainen toimitus, kun ostos on vähintään (€)</span>
            <input type="number" min="1" step="0.01" value={company.free_shipping_threshold_cents / 100} onChange={(event) => { setCompany({ ...company, free_shipping_threshold_cents: Math.max(100, Math.round(Number(event.target.value) * 100) || 100) }); setFreeShippingFeedback(""); }} inputMode="decimal" />
            <small>Raja lasketaan alennusten jälkeen vain oman yrityksesi tuotteista.</small>
          </label>}
        </div>
        <div className={styles.freeShippingActions}>
          <button type="button" className={styles.button} disabled={saving} onClick={() => void saveFreeShipping()}>{saving ? "Tallennetaan…" : "Tallenna asetus"}</button>
          {freeShippingFeedback && <p className={company.free_shipping_threshold_cents == null ? styles.freeShippingSavedOff : styles.freeShippingSavedOn} role="status">{freeShippingFeedback}</p>}
        </div>
      </section>

      <div className={styles.twoColumn}>
        <section className={styles.panel}><div className={styles.sectionHeading}><div><div className={styles.eyebrow}>Uusi kampanja</div><h2>Luo alennuskoodi</h2><p className={styles.muted}>Koodi alentaa vain sinun yrityksesi tuotteita yhteisessä ostoskorissa.</p></div><TicketPercent size={34} /></div>
          <div className={styles.formGrid}>
            <label className={styles.field}><span>Alennuskoodi</span><input value={discountForm.code} maxLength={40} onChange={(event) => setDiscountForm({ ...discountForm, code: event.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="KESÄ20" /></label>
            <label className={styles.field}><span>Kampanjan nimi</span><input value={discountForm.name} onChange={(event) => setDiscountForm({ ...discountForm, name: event.target.value })} placeholder="Kesäkampanja" /></label>
            <label className={styles.field}><span>Alennuksen tapa</span><select value={discountForm.discount_type} onChange={(event) => setDiscountForm({ ...discountForm, discount_type: event.target.value === "fixed" ? "fixed" : "percent" })}><option value="percent">Prosenttialennus</option><option value="fixed">Euromääräinen alennus</option></select></label>
            <label className={styles.field}><span>{discountForm.discount_type === "percent" ? "Alennus (%)" : "Alennus (€)"}</span><input type="number" min="0.01" max={discountForm.discount_type === "percent" ? 100 : undefined} step="0.01" value={discountForm.value} onChange={(event) => setDiscountForm({ ...discountForm, value: Number(event.target.value) })} /></label>
            <label className={styles.field}><span>Tilauksen vähimmäissumma (€)</span><input type="number" min="0" step="0.01" value={discountForm.minimum_order_euros} onChange={(event) => setDiscountForm({ ...discountForm, minimum_order_euros: Number(event.target.value) || 0 })} /></label>
            <label className={styles.field}><span>Käyttökerrat yhteensä</span><input type="number" min="1" value={discountForm.maximum_uses} onChange={(event) => setDiscountForm({ ...discountForm, maximum_uses: event.target.value })} placeholder="Rajaton" /></label>
            <label className={styles.field}><span>Alkaa</span><input type="datetime-local" value={discountForm.starts_at} onChange={(event) => setDiscountForm({ ...discountForm, starts_at: event.target.value })} /></label>
            <label className={styles.field}><span>Päättyy</span><input type="datetime-local" value={discountForm.expires_at} onChange={(event) => setDiscountForm({ ...discountForm, expires_at: event.target.value })} /></label>
          </div><button className={styles.button} disabled={saving || !discountForm.code || discountForm.value <= 0} onClick={() => void createDiscount()}><TicketPercent size={17} /> Luo alennuskoodi</button>
        </section>

        <aside className={styles.panel}><div className={styles.sectionHeading}><div><h2>Alennuskoodit</h2><p className={styles.muted}>Käyttömäärä päivittyy vasta onnistuneen maksun jälkeen.</p></div><span className={styles.badgeOrange}>{discounts.length}</span></div><div className={styles.discountCodeList}>{discounts.length === 0 ? <div className={styles.empty}>Ei vielä alennuskoodeja.</div> : discounts.map((discount) => <article className={discount.active ? styles.discountCodeCard : styles.discountCodeCardInactive} key={discount.id}><header><span><TicketPercent size={18} /></span><div><strong>{discount.code}</strong><small>{discount.name || "Nimetön kampanja"}</small></div><em>{discount.discount_type === "percent" ? `${discount.discount_value / 100} %` : money(discount.discount_value)}</em></header><div className={styles.discountCodeMeta}><span>Käytetty <strong>{discount.used_count}{discount.maximum_uses == null ? " / ∞" : ` / ${discount.maximum_uses}`}</strong></span><span>Minimi <strong>{money(discount.minimum_order_cents)}</strong></span><span>Voimassa <strong>{discount.expires_at ? new Date(discount.expires_at).toLocaleDateString("fi-FI") : "toistaiseksi"}</strong></span></div><footer><button className={styles.buttonSecondary} disabled={saving} onClick={() => void toggleDiscount(discount)}>{discount.active ? "Keskeytä" : "Aktivoi"}</button><button className={styles.buttonDanger} disabled={saving} onClick={() => void deleteDiscount(discount.id)}>Poista</button></footer></article>)}</div></aside>
      </div>

      <section className={`${styles.panel} ${styles.productDiscountWorkspace}`}>
        <div className={styles.sectionHeading}><div><div className={styles.eyebrow}>Prosenttikampanja</div><h2>Valitse alennettavat tuotteet</h2><p className={styles.muted}>Vain julkaistut ja varastossa olevat tuotteet näkyvät tässä. Poistetut, piilotetut ja loppuneet ilmoitukset on rajattu pois.</p></div><Tag size={32} /></div>
        <div className={styles.productDiscountToolbar}>
          <label className={styles.productDiscountPercent}><span>Alennusprosentti</span><div><input type="number" min="1" max="99" step="1" value={bulkSaleForm.percent} onChange={(event) => setBulkSaleForm((current) => ({ ...current, percent: event.target.value }))} /><strong>%</strong></div></label>
          <label><span>Alkaa (valinnainen)</span><input type="datetime-local" value={bulkSaleForm.starts} onChange={(event) => setBulkSaleForm((current) => ({ ...current, starts: event.target.value }))} /></label>
          <label><span>Päättyy (valinnainen)</span><input type="datetime-local" value={bulkSaleForm.ends} onChange={(event) => setBulkSaleForm((current) => ({ ...current, ends: event.target.value }))} /></label>
          <div className={styles.productDiscountToolbarActions}><button type="button" className={styles.button} disabled={saving || selectedSaleProductIds.length === 0} onClick={() => void applyProductDiscount()}><TicketPercent size={17} /> {saving ? "Tallennetaan…" : `Aseta ${bulkSaleForm.percent || 0} % alennus`}</button><button type="button" className={styles.buttonDanger} disabled={saving || selectedSaleProductIds.length === 0} onClick={() => void applyProductDiscount(selectedSaleProductIds, true)}>Poista valittujen alennus</button></div>
        </div>
        <div className={styles.productDiscountSelectionBar}>
          <label><input type="checkbox" checked={discountProducts.length > 0 && selectedSaleProductIds.length === discountProducts.length} onChange={(event) => setSelectedSaleProductIds(event.target.checked ? discountProducts.map((product) => product.id) : [])} /><span>Valitse kaikki tuotteet</span></label>
          <strong>{selectedSaleProductIds.length} / {discountProducts.length} valittu</strong>
        </div>
        <div className={styles.productDiscountGrid}>{discountProducts.length === 0 ? <div className={styles.empty}>Ei julkaistuja ja varastossa olevia tuotteita.</div> : discountProducts.map((product) => { const selected = selectedSaleProductIds.includes(product.id); const savedDiscount = product.sale_price_cents != null && product.sale_price_cents < product.price_cents; const savedPercent = savedDiscount ? Math.max(1, Math.round((1 - product.sale_price_cents! / product.price_cents) * 100)) : 0; return <article className={selected ? styles.productDiscountCardSelected : styles.productDiscountCard} key={product.id}><label className={styles.productDiscountSelect}><input type="checkbox" checked={selected} onChange={(event) => setSelectedSaleProductIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id))} /><span>{selected ? "Valittu kampanjaan" : "Valitse tuote"}</span></label><div className={styles.productDiscountIdentity}>{product.image_urls?.[0] ? <Image src={product.image_urls[0]} width={110} height={86} alt="" unoptimized /> : <ImageIcon size={26} />}<span><strong>{product.name}</strong><small>Normaalihinta {money(product.price_cents)}</small>{savedDiscount && <small className={styles.productDiscountSalePrice}>Alehinta {money(product.sale_price_cents!)}</small>}</span><em className={savedDiscount ? styles.productDiscountActive : styles.productDiscountInactive}>{savedDiscount ? `−${savedPercent} %` : "Normaalihinta"}</em></div><footer>{savedDiscount ? <><span>Alennus on käytössä{product.sale_ends_at ? ` ${new Date(product.sale_ends_at).toLocaleDateString("fi-FI")} asti` : " toistaiseksi"}.</span><button type="button" className={styles.buttonDanger} disabled={saving} onClick={() => void applyProductDiscount([product.id], true)}>Poista alennus</button></> : <span>Valitse tuote ja julkaise prosenttialennus yllä.</span>}</footer></article>; })}</div>
      </section>
    </div>}

    {tab === "shipping" && company && <div className={styles.shippingWorkspace}>
      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><div className={styles.eyebrow}>Toimitusalueet</div><h2>Minne yrityksesi toimittaa?</h2><p className={styles.muted}>Valitse vain maat, joihin pystyt oikeasti toimittamaan. Kassa estää tilauksen muihin maihin.</p></div><Globe2 size={32} /></div>
        <div className={styles.carrierToggles}><button type="button" className={company.posti_enabled ? styles.carrierToggleActive : styles.carrierToggle} onClick={() => setCompany({ ...company, posti_enabled: !company.posti_enabled })}><Truck size={20} /><span><strong>Posti</strong><small>{company.posti_enabled ? "Käytössä" : "Pois käytöstä"}</small></span><CheckCircle2 size={18} /></button></div>
        <div className={styles.shippingRegionGrid}>{SHIPPING_REGIONS.map((region) => { const enabled = (company.shipping_countries ?? ["FI"]).includes(region.code); const postiPrice = company[region.field]; return <article className={enabled ? styles.shippingRegionActive : styles.shippingRegion} key={region.code}><button type="button" onClick={() => toggleShippingCountry(region.code)} aria-pressed={enabled}><img src={`https://flagcdn.com/48x36/${region.code.toLowerCase()}.png`} alt="" /><span><strong>{region.name}</strong><small>{enabled ? "Toimitus käytössä" : "Ei toimitusta"}</small></span><i>{enabled ? <CheckCircle2 size={18} /> : <X size={18} />}</i></button>{enabled && <div className={styles.regionCarrierPrices}>{company.posti_enabled && <label className={styles.field}><span>Posti (€)</span><input type="number" min="0" step="0.01" value={postiPrice == null ? "" : postiPrice / 100} onChange={(event) => setCompany({ ...company, [region.field]: event.target.value === "" ? null : Math.max(0, Math.round(Number(event.target.value) * 100)) })} placeholder="0,00" /></label>}</div>}</article>; })}</div>
        {(company.shipping_countries ?? []).length === 0 && <p className={styles.warning}>Valitse vähintään yksi toimitusmaa tai tarjoa tuotteille vain nouto.</p>}
        <div className={styles.shippingRules}>
          <label className={styles.field}><span>Usean tuotteen toimituskulut</span><select value={company.shipping_price_strategy} onChange={(event) => setCompany({ ...company, shipping_price_strategy: event.target.value === "sum" ? "sum" : "max" })}><option value="max">Veloita korkein toimitushinta</option><option value="sum">Laske toimitushinnat yhteen</option></select><small>“Korkein” sopii tilanteeseen, jossa tuotteet pakataan samaan lähetykseen.</small></label>
        </div>
      </section>
      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><div className={styles.eyebrow}>Nouto</div><h2>Asiakkaan noutoviesti</h2><p className={styles.muted}>Viesti lisätään noutotilauksen vahvistukseen ja lähetetään uudelleen, kun tilaus on valmis.</p></div><Store size={30} /></div>
        <label className={styles.field}><span>Nouto-ohjeen kirjoituskieli</span><select value={pickupSourceLanguage} onChange={(event) => setPickupSourceLanguage(event.target.value as ReturnLanguage)}>{RETURN_LANGUAGES.map((language) => <option key={language} value={language}>{RETURN_LANGUAGE_LABELS[language]}</option>)}</select><small className={styles.muted}>Ohje käännetään tallennettaessa automaattisesti suomeksi, englanniksi, ruotsiksi ja norjaksi.</small></label>
        <label className={styles.field}><span>Nouto-ohje</span><textarea rows={8} maxLength={1800} value={company.pickup_email_message} onChange={(event) => setCompany({ ...company, pickup_email_message: event.target.value })} placeholder="Esimerkiksi: Nouto arkisin klo 9–16 lastausovelta. Ota tilausnumero mukaan ja soita ovikelloa." /><small>{company.pickup_email_message.length} / 1800 merkkiä</small></label>
        <div className={styles.pickupEmailPreview}><span><MailCheck size={17} /> MASKINES · NOUTOVIESTI</span><strong>Tilauksesi on valmis noudettavaksi</strong><p>Hei asiakas, tilauksesi on valmis.</p><p>{company.pickup_email_message.trim() || "Kirjoita yrityksesi nouto-ohje yllä."}</p><small>Yrityksen nimi, tilausnumero, tuotteet ja nouto-osoite lisätään automaattisesti.</small></div>
        <div className={styles.actions}><button className={styles.button} disabled={saving || !company.pickup_email_message.trim() || !company.posti_enabled || (company.shipping_countries ?? []).length === 0 || (company.shipping_countries ?? []).some((code) => { const region = SHIPPING_REGIONS.find((item) => item.code === code); return region ? company[region.field] == null : false; })} onClick={() => void saveDeliverySettings()}><Truck size={17} />{saving ? "Tallennetaan ja käännetään…" : "Tallenna toimitusasetukset"}</button></div>
      </section>
    </div>}

    {tab === "returns" && returnPolicy && <><div className={styles.returnWorkspace}>
      <section className={styles.panel}>
        <div className={styles.row}><div><h2>Yrityksen palautusasetukset</h2><p className={styles.muted}>Nämä tiedot tallennetaan tilauskohtaisesti ja muodostetaan asiakkaalle suojatuksi PDF-tiedostoksi.</p></div><span className={returnPolicy.enabled ? styles.badge : styles.badgeGray}>{returnPolicy.enabled ? "Käytössä" : "Pois käytöstä"}</span></div>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Palautukset</span><select value={returnPolicy.enabled ? "on" : "off"} onChange={(event) => updateReturnPolicy({ enabled: event.target.value === "on" })}><option value="on">Käytössä</option><option value="off">Pois käytöstä</option></select></label>
          <label className={styles.field}><span>Palautusaika (päivää)</span><input type="number" min="1" max="365" value={returnPolicy.return_window_days} onChange={(event) => updateReturnPolicy({ return_window_days: Number(event.target.value) || 14 })} /></label>
          <label className={styles.field}><span>Vastaanottajan nimi</span><input value={returnPolicy.recipient_name} onChange={(event) => updateReturnPolicy({ recipient_name: event.target.value })} /></label>
          <label className={styles.field}><span>Myyjäyrityksen nimi</span><input value={company?.name ?? returnPolicy.company_name} readOnly aria-readonly="true" /><small>Nimi tulee aina vahvistetusta yritysprofiilista ja lisätään PDF:ään automaattisesti.</small></label>
          <label className={styles.field}><span>Palautusosoite</span><input value={returnPolicy.address_line} onChange={(event) => updateReturnPolicy({ address_line: event.target.value })} /></label>
          <label className={styles.field}><span>Postinumero</span><input value={returnPolicy.postal_code} onChange={(event) => updateReturnPolicy({ postal_code: event.target.value })} /></label>
          <label className={styles.field}><span>Kaupunki</span><input value={returnPolicy.city} onChange={(event) => updateReturnPolicy({ city: event.target.value })} /></label>
          <label className={styles.field}><span>Maa</span><select value={returnPolicy.country} onChange={(event) => updateReturnPolicy({ country: event.target.value })}>{[["FI","Suomi"],["SE","Ruotsi"],["NO","Norja"],["DK","Tanska"],["DE","Saksa"]].map(([code,name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <label className={styles.field}><span>Palautusten sähköposti</span><input type="email" value={returnPolicy.email} onChange={(event) => updateReturnPolicy({ email: event.target.value })} /></label>
          <label className={styles.field}><span>Puhelinnumero</span><input value={returnPolicy.phone} onChange={(event) => updateReturnPolicy({ phone: event.target.value })} /></label>
          <label className={styles.field}><span>Palautuksen toimitustapa</span><input value={returnPolicy.shipping_method} onChange={(event) => updateReturnPolicy({ shipping_method: event.target.value })} /></label>
          <label className={styles.field}><span>Palautuskulun maksaja</span><select value={returnPolicy.shipping_payer} onChange={(event) => updateReturnPolicy({ shipping_payer: event.target.value === "seller" ? "seller" : "customer" })}><option value="customer">Asiakas</option><option value="seller">Myyjä</option></select></label>
          <label className={styles.field}><span>Palautustunnus tai sopimusnumero</span><input value={returnPolicy.return_identifier} onChange={(event) => updateReturnPolicy({ return_identifier: event.target.value })} /></label>
          <label className={styles.field}><span>Asiakaspalvelun yhteystiedot</span><input value={returnPolicy.customer_service} onChange={(event) => updateReturnPolicy({ customer_service: event.target.value })} /></label>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Kirjoituskieli</span>
            <select value={returnSourceLanguage} onChange={(event) => setReturnSourceLanguage(event.target.value as ReturnLanguage)}>
              {RETURN_LANGUAGES.map((language) => <option key={language} value={language}>{RETURN_LANGUAGE_LABELS[language]}</option>)}
            </select>
            <small className={styles.muted}>Kirjoita tekstit kerran. Tallennettaessa ne käännetään automaattisesti suomeksi, englanniksi, ruotsiksi ja norjaksi.</small>
          </label>
        </div>
        {([['instructions','14 päivän palautusoikeus'],['conditions','Palautuksen ehdot'],['packing','Pakkausohjeet'],['exclusions','Tuotteet, joita ei voi palauttaa']] as const).map(([field,label]) => <label className={styles.field} key={field}><span>{label} · {RETURN_LANGUAGE_LABELS[returnSourceLanguage]}{field === "instructions" ? " · pakollinen suoramyynnissä" : " · vapaaehtoinen"}</span><textarea rows={field === "instructions" ? 7 : 4} value={returnPolicy.translations[returnSourceLanguage]?.[field] ?? ""} onChange={(event) => updateReturnTranslation(field, event.target.value)} placeholder={field === "instructions" ? "Kirjoita tähän yrityksesi 14 päivän palautusoikeus ja asiakkaan toimintaohjeet." : "Vapaaehtoinen – tyhjä osio jätetään pois PDF:stä."} /></label>)}
        <div className={styles.returnOptions}>{([['automatic_pdf','Luo palautusohjeiden PDF automaattisesti'],['attach_to_confirmation','Liitä tilausvahvistukseen'],['attach_to_shipping','Liitä toimitusvahvistukseen'],['customer_download','Salli asiakkaan lataus']] as const).map(([field,label]) => <label key={field}><input type="checkbox" checked={returnPolicy[field]} onChange={(event) => updateReturnPolicy({ [field]: event.target.checked })} /> {label}</label>)}</div>
        <div className={styles.actions}><button className={styles.button} disabled={saving} onClick={() => void saveReturnPolicy()}><ShieldCheck size={17} />{saving ? "Tallennetaan…" : "Tallenna ja julkaise"}</button></div>
        {returnPolicy.updated_at && <p className={styles.muted}>Viimeksi päivitetty {new Date(returnPolicy.updated_at).toLocaleString("fi-FI")}</p>}
      </section>
      <aside className={styles.panel}><h2>PDF-esikatselu</h2><p className={styles.muted}>Asiakkaan kuitti ja palautusohjeet muodostetaan hänen kassalla käyttämällään kielellä. Tyhjät tekstiosiot jätetään PDF:stä pois.</p><div className={styles.returnLanguageTabs}>{RETURN_LANGUAGES.map((language) => <button type="button" key={language} className={returnLanguage === language ? styles.orderFilterActive : styles.orderFilter} onClick={() => setReturnLanguage(language)}>{RETURN_LANGUAGE_LABELS[language]}</button>)}</div><div className={styles.returnPreview}><strong>{company?.name ?? returnPolicy.company_name}</strong><h3>{RETURN_SECTION_LABELS[returnLanguage].instructions}</h3><p>{RETURN_PREVIEW_ORDER_LABELS[returnLanguage].order} MASK-XXXX · {RETURN_PREVIEW_ORDER_LABELS[returnLanguage].returnWithin} {returnPolicy.return_window_days} {RETURN_PREVIEW_ORDER_LABELS[returnLanguage].days}</p><p>{returnPolicy.recipient_name}<br />{returnPolicy.address_line}<br />{returnPolicy.postal_code} {returnPolicy.city}, {returnPolicy.country}{company?.business_id ? <><br />{RETURN_META_LABELS[returnLanguage].businessId}: {company.business_id}</> : null}{returnPolicy.email ? <><br />{RETURN_META_LABELS[returnLanguage].email}: {returnPolicy.email}</> : null}{returnPolicy.phone ? <><br />{RETURN_META_LABELS[returnLanguage].phone}: {returnPolicy.phone}</> : null}</p>{(["instructions", "conditions", "packing", "exclusions"] as const).map((field) => { const text = returnPreviewText(returnPolicy, returnLanguage, field); return text ? <div key={field}><h4>{RETURN_SECTION_LABELS[returnLanguage][field]}</h4><p>{text}</p></div> : null; })}<div><h4>{RETURN_META_LABELS[returnLanguage].shipping}</h4><p>{returnPolicy.shipping_method ? <>{RETURN_META_LABELS[returnLanguage].shippingMethod}: {returnPolicy.shipping_method}<br /></> : null}{RETURN_META_LABELS[returnLanguage].shippingPayer}: {returnPolicy.shipping_payer === "seller" ? RETURN_META_LABELS[returnLanguage].seller : RETURN_META_LABELS[returnLanguage].customer}{returnPolicy.return_identifier ? <><br />{RETURN_META_LABELS[returnLanguage].identifier}: {returnPolicy.return_identifier}</> : null}{returnPolicy.customer_service ? <><br />{RETURN_META_LABELS[returnLanguage].customerService}: {returnPolicy.customer_service}</> : null}</p></div></div></aside>
    </div><section className={`${styles.panel} ${styles.returnCases}`}><div className={styles.row}><div><h2>Palautuspyynnöt</h2><p className={styles.muted}>Kaikki muutokset kirjataan palautuksen tapahtumahistoriaan.</p></div><span className={styles.badgeGray}>{returns.length}</span></div>{returns.length === 0 ? <p className={styles.empty}>Ei avoimia palautuspyyntöjä.</p> : returns.map((item) => <article key={item.id}><div><strong>{item.return_number}</strong><small>{item.order?.order_number} · {item.order?.customer_name} · {new Date(item.created_at).toLocaleDateString("fi-FI")}</small><p>{item.reason}{item.description ? ` — ${item.description}` : ""}</p></div><label className={styles.field}><span>Tila</span><select disabled={saving} value={item.status} onChange={(event) => void updateReturnStatus(item, event.target.value)}>{[["requested","Palautusta pyydetty"],["pending_approval","Odottaa hyväksyntää"],["approved","Hyväksytty"],["rejected","Hylätty"],["in_transit","Tuote matkalla"],["received","Vastaanotettu"],["inspection","Tarkastuksessa"],["refund_processing","Hyvitys käsittelyssä"],["refunded","Hyvitetty"],["closed","Suljettu"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></article>)}</section></>}

    {tab === "products" && <div className={editingId ? styles.twoColumn : styles.productManagementOnly}>
      {editingId && <section className={styles.panel}><div className={styles.row}><div><div className={styles.eyebrow}>Ilmoituksen muokkaus</div><h2>Muokkaa myynti-ilmoitusta</h2></div></div>
        <div className={styles.formGrid}>
          <label className={styles.fieldFull}><span>Tuotteen nimi</span><input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
          <label className={styles.fieldFull}><span>Kuvaus</span><textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
          <label className={styles.fieldFull}><span>Yrityskaupan oma kategoria</span><input list="storefront-category-options" value={productForm.storefront_category ?? ""} onChange={(event) => setProductForm({ ...productForm, storefront_category: event.target.value || null })} placeholder="Valitse tai kirjoita oma kategoria" /><datalist id="storefront-category-options">{company?.storefront_categories.map((category) => <option key={category} value={category} />)}</datalist><small className={styles.muted}>Voit kirjoittaa myös uuden kategorian. Tuotteen voi lisätä suoraan yrityskauppaan riippumatta Maskinesin yleisistä ajoneuvo- ja varaosakategorioista.</small></label>
          <label className={styles.field}>
            <span>{company?.fee_pricing_strategy === "include" ? "Tavoitesumma sinulle (€)" : "Ostajalle näkyvä hinta (€)"}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={(productEntryCents / 100).toString()}
              onChange={(event) => {
                const cents = Math.max(0, Math.round((Number(event.target.value) || 0) * 100));
                setProductForm(company?.fee_pricing_strategy === "include"
                  ? { ...productForm, seller_target_price_cents: cents, price_cents: grossUpCommercePrice(cents, selectedFeeMethod) }
                  : { ...productForm, price_cents: cents, seller_target_price_cents: null });
              }}
            />
          </label>
          <label className={styles.field}><span>Verokäsittely</span><select value={productForm.vat_rate} onChange={(event) => setProductForm({ ...productForm, vat_rate: Number(event.target.value) })}>{VAT_RATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small className={styles.muted}>Marginaaliverotusta ei näytetä myynti-ilmoituksessa. Merkintä lisätään vain kuittiin.</small></label>
          <label className={styles.field}><span>Varastosaldo (kpl)</span><input type="number" min="0" value={productForm.stock_quantity} onChange={(event) => setProductForm({ ...productForm, stock_quantity: Math.max(0, Math.trunc(Number(event.target.value) || 0)) })} /></label>
          <label className={styles.fieldFull}><span>Tuotekuvat</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImages(event.target.files)} /></label>
          {productForm.image_urls.length > 0 && <div className={`${styles.wrap} ${styles.fieldFull}`}>{productForm.image_urls.map((url) => <span key={url} style={{ position: "relative" }}><Image className={styles.thumb} src={url} width={148} height={124} alt="" unoptimized /><button type="button" aria-label="Poista kuva" onClick={() => setProductForm({ ...productForm, image_urls: productForm.image_urls.filter((item) => item !== url) })}>×</button></span>)}</div>}
        </div>
        {productEntryCents > 0 && <div className={styles.pricePreview}>
          <div><span>Ostajalle näkyvä hinta</span><strong>{money(productPublicPriceCents)}</strong></div>
          <div><span>Maskines 1 %</span><strong>− {money(productFeePreview.maskinesFeeCents)}</strong></div>
          <div><span>Stripe-arvio ({FEE_METHODS.find((method) => method.id === selectedFeeMethod)?.shortLabel})</span><strong>− {money(productFeePreview.stripeFeeCents)}</strong></div>
          <div><span>Arvio sinulle</span><strong>{money(productFeePreview.sellerNetCents)}</strong></div>
        </div>}
        <div className={styles.divider} /><h3>Toimitustavat</h3>
        <div className={styles.list}><label className={styles.listItem}><span className={styles.check}><input type="checkbox" checked={productForm.pickup_available} onChange={(event) => setProductForm({ ...productForm, pickup_available: event.target.checked })} />Nouto saatavilla</span></label>{productForm.pickup_available && <div className={styles.formGrid}><label className={styles.fieldFull}><span>Nouto-osoite (jätä tyhjäksi käyttääksesi yrityksen oletusosoitetta)</span><input value={productForm.pickup_address_override ?? ""} onChange={(event) => setProductForm({ ...productForm, pickup_address_override: event.target.value || null })} /></label><label className={styles.fieldFull}><span>Nouto-ohjeet</span><textarea value={productForm.pickup_instructions ?? ""} onChange={(event) => setProductForm({ ...productForm, pickup_instructions: event.target.value || null })} placeholder="Nouto arkisin klo 9–16 varaston lastausovelta." /></label></div>}
          <label className={styles.listItem}><span className={styles.check}><input type="checkbox" checked={productForm.shipping_available} onChange={(event) => setProductForm({ ...productForm, shipping_available: event.target.checked, posti_enabled: event.target.checked && Boolean(company?.posti_enabled) })} />Kuljetus saatavilla</span></label>
          {productForm.shipping_available && <div className={styles.wrap}><label className={styles.check}><input type="checkbox" checked={productForm.posti_enabled} disabled={!company?.posti_enabled} onChange={(event) => setProductForm({ ...productForm, posti_enabled: event.target.checked })} /> Posti</label></div>}
          {productForm.shipping_available && <div className={styles.formGrid}>
            <label className={styles.field}><span>Postikulu Suomeen (€)</span><input type="number" min="0" step="0.01" value={productForm.shipping_price_fi_cents === null ? "" : productForm.shipping_price_fi_cents / 100} onChange={(event) => { const cents = event.target.value === "" ? null : Math.round(Number(event.target.value) * 100); setProductForm({ ...productForm, shipping_price_cents: cents, shipping_price_fi_cents: cents }); }} placeholder={company?.default_shipping_price_fi_cents == null ? "" : String(company.default_shipping_price_fi_cents / 100)} /></label>
            <label className={styles.field}><span>Postikulu Ruotsiin (€)</span><input type="number" min="0" step="0.01" value={productForm.shipping_price_se_cents === null ? "" : productForm.shipping_price_se_cents / 100} onChange={(event) => setProductForm({ ...productForm, shipping_price_se_cents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) })} placeholder={company?.default_shipping_price_se_cents == null ? "" : String(company.default_shipping_price_se_cents / 100)} /></label>
            <label className={styles.field}><span>Postikulu Norjaan (€)</span><input type="number" min="0" step="0.01" value={productForm.shipping_price_no_cents === null ? "" : productForm.shipping_price_no_cents / 100} onChange={(event) => setProductForm({ ...productForm, shipping_price_no_cents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) })} placeholder={company?.default_shipping_price_no_cents == null ? "" : String(company.default_shipping_price_no_cents / 100)} /></label>
          </div>}
        </div>
        <label className={styles.check} style={{ marginTop: 18 }}><input type="checkbox" checked={productForm.active} disabled={!canPublishProduct(company) || !deliverySettingsAreReady(company, returnPolicy, productForm)} onChange={(event) => setProductForm({ ...productForm, active: event.target.checked })} />Julkaise aktiiviseksi</label>{(!canPublishProduct(company) || !deliverySettingsAreReady(company, returnPolicy, productForm)) && <p className={styles.notice}>Voit tallentaa luonnoksen. Julkaisu avautuu, kun yritys ja Stripe ovat valmiit sekä palautus- ja toimitusasetukset on täytetty ja tallennettu.</p>}
        <button className={styles.button} disabled={saving} onClick={saveProduct}>{saving ? "Tallennetaan…" : productForm.active ? "Tallenna ja julkaise" : "Tallenna luonnos"}</button>
      </section>}
      <aside className={styles.panel}><div className={styles.row}><h2>Myynti-ilmoitukset</h2><span>{managedProducts.length}</span></div><div className={styles.list}>{managedProducts.length === 0 ? <p className={styles.empty}>Ei ilmoituksia.</p> : managedProducts.map((product) => { const estimate = estimateCommerceFees(product.price_cents, selectedFeeMethod); const publishReady = canPublishProduct(company) && deliverySettingsAreReady(company, returnPolicy, product); return <div className={styles.listItem} key={product.id}><div className={styles.row}><div><strong>{product.name}</strong><div className={styles.wrap}><span className={product.active ? styles.badge : styles.badgeGray}>{product.active ? "Julkaistu" : "Luonnos"}</span><span className={styles.badgeOrange}>{deliveryLabel(product)}</span></div><p>{money(product.price_cents)} · saldo {product.stock_quantity} kpl</p><small className={styles.muted}>Arvio sinulle {money(estimate.sellerNetCents)} ({FEE_METHODS.find((method) => method.id === selectedFeeMethod)?.shortLabel})</small></div>{product.image_urls?.[0] && <Image className={styles.thumb} src={product.image_urls[0]} width={148} height={124} alt="" unoptimized />}</div><div className={styles.wrap}><button className={product.active ? styles.buttonDanger : styles.button} disabled={saving || (!product.active && !publishReady)} title={!product.active && !publishReady ? "Täytä ensin palautus- ja toimitusasetukset." : undefined} onClick={() => toggleProduct(product)}>{product.active ? "Piilota" : "Julkaise"}</button>{product.active && <Link className={styles.buttonSecondary} href={`/tuotteet/${product.id}`}>Avaa</Link>}</div></div>; })}</div></aside>
    </div>}

    {tab === "orders" && <section className={`${styles.panel} ${styles.ordersPanel}`}>
      <div className={styles.sectionHeading}><div><div className={styles.eyebrow}>Tilausten työjono</div><h2>Tilaukset ja toimitukset</h2><p className={styles.muted}>Aloita vasemmalta uusista tilauksista ja siirrä tilaus vaihe vaiheelta valmiiksi. Kiireelliset tehtävät näkyvät heti.</p></div><span className={styles.badgeOrange}>{orders.filter((order) => !new Set(["completed", "cancelled"]).has(order.fulfillment_status)).length} avoinna</span></div>

      <div className={styles.orderWorkQueue} aria-label="Tilausten työvaiheet">
        <button type="button" className={orderFilter === "new" ? styles.orderWorkQueueActive : ""} onClick={() => setOrderFilter("new")}><span><Store size={19} /></span><small>1. Uudet</small><strong>{orders.filter((order) => order.fulfillment_status === "unfulfilled").length}</strong><em>Odottaa käsittelyä</em></button>
        <button type="button" className={orderFilter === "processing" ? styles.orderWorkQueueActive : ""} onClick={() => setOrderFilter("processing")}><span><PackagePlus size={19} /></span><small>2. Valmistelussa</small><strong>{orders.filter((order) => order.fulfillment_status === "processing").length}</strong><em>Keräily tai noutovalmistelu</em></button>
        <button type="button" className={orderFilter === "awaiting_tracking" ? styles.orderWorkQueueAttention : ""} onClick={() => setOrderFilter("awaiting_tracking")}><span><Clock3 size={19} /></span><small>3. Vaatii toimenpiteen</small><strong>{awaitingTrackingCount}</strong><em>Seurantakoodi puuttuu</em></button>
        <button type="button" className={orderFilter === "ready" ? styles.orderWorkQueueActive : ""} onClick={() => setOrderFilter("ready")}><span><Truck size={19} /></span><small>4. Matkalla tai noudettavissa</small><strong>{orders.filter((order) => new Set(["shipped", "ready_for_pickup"]).has(order.fulfillment_status)).length}</strong><em>Asiakkaalle ilmoitettu</em></button>
        <button type="button" className={orderFilter === "completed" ? styles.orderWorkQueueActive : ""} onClick={() => setOrderFilter("completed")}><span><CheckCircle2 size={19} /></span><small>5. Valmiit</small><strong>{orders.filter((order) => order.fulfillment_status === "completed").length}</strong><em>Toimitettu loppuun</em></button>
      </div>

      <div className={styles.orderFilters}>
        {([
          ["all", "Kaikki", orders.length],
          ["open", "Avoimet", orders.filter((order) => !new Set(["completed", "cancelled"]).has(order.fulfillment_status)).length],
          ["awaiting_tracking", "Vaatii seurantakoodin", awaitingTrackingCount],
          ["ready", "Matkalla tai noudettavissa", orders.filter((order) => new Set(["shipped", "ready_for_pickup"]).has(order.fulfillment_status)).length],
          ["completed", "Valmiit", orders.filter((order) => order.fulfillment_status === "completed").length],
          ["pickup", "Noutotilaukset", orders.filter((order) => order.shipping_method === "pickup").length]
        ] as Array<[OrderFilter, string, number]>).map(([id, label, count]) => <button type="button" key={id} className={orderFilter === id ? styles.orderFilterActive : styles.orderFilter} onClick={() => setOrderFilter(id)}><span>{label}</span><strong>{count}</strong></button>)}
      </div>

      {orders.length === 0 ? <div className={styles.empty}>Ei tilauksia.</div> : filteredOrders.length === 0 ? <div className={styles.empty}>Tässä ryhmässä ei ole tilauksia.</div> : <div className={styles.orderList}>{filteredOrders.map((order) => {
        const statuses = order.shipping_method === "pickup" ? PICKUP_STATUSES : SHIPPING_STATUSES;
        const expanded = expandedOrderId === order.id;
        const deliveryPlace = order.shipping_method === "pickup"
          ? "Nouto yritykseltä"
          : order.pickup_point_name ?? order.pickup_point_address ?? "Postin noutopiste";
        return <article className={styles.orderCard} key={order.id}>
          <button type="button" className={styles.orderCardSummary} aria-expanded={expanded} onClick={() => setExpandedOrderId(expanded ? null : order.id)}>
            <span className={styles.orderSummaryIdentity}><strong className={styles.orderNumber}>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString("fi-FI")} · {(order.order_items ?? []).length} tuoteriviä</small></span>
            <span className={styles.orderSummaryFacts}><span><small>Hinta</small><strong>{money(order.total_cents)}</strong></span><span><small>Toimituspaikka</small><strong>{deliveryPlace}</strong></span></span>
            <span className={styles.orderHeaderBadges}><span className={order.payment_status === "paid" ? styles.badge : order.payment_status === "processing_error" ? styles.badgeOrange : styles.badgeGray}>{order.payment_status === "paid" ? "Maksettu" : order.payment_status}</span><span className={styles.orderCurrentStatus}><FulfillmentIcon status={order.fulfillment_status} />{fulfillmentLabel(order.fulfillment_status)}</span><ChevronDown className={expanded ? styles.orderChevronOpen : styles.orderChevron} size={20} /></span>
          </button>

          {expanded && <div className={styles.orderCardDetails}>

          <div className={styles.orderMetaGrid}>
            <div><MailCheck size={17} /><span>Ostaja</span><strong>{order.customer_name} · {order.customer_email}</strong></div>
            <div><CircleDollarSign size={17} /><span>Maksettu</span><strong>{money(order.total_cents)}</strong></div>
            <div><Truck size={17} /><span>Toimitustapa</span><strong>{order.shipping_method === "pickup" ? "Nouto" : `Posti · ${order.pickup_point_name ?? "noutopiste"}`}</strong></div>
          </div>

          <div className={styles.orderProducts}>{order.order_items?.map((item) => <span key={item.id}>{item.product_name}<strong>× {item.quantity}</strong></span>)}</div>
          <div className={styles.actions}><button type="button" className={styles.buttonSecondary} onClick={() => void downloadReturnPdf(order)}><Download size={17} /> Lataa palautusohjeet PDF</button></div>
          {order.payment_error && <div className={styles.orderPaymentWarning}><AlertTriangle size={18} /><div><strong>Maksuun tai tilitykseen liittyvä huomio</strong><p>{safeOrderWarning(order.payment_error)}</p></div>{/tilitys|destination|acct_/i.test(order.payment_error) && <button type="button" onClick={() => selectTab("profile")}>Avaa maksuasetukset</button>}</div>}

          {order.shipping_method !== "pickup" && <div className={styles.trackingPanel}>
            <div className={styles.trackingPanelTitle}><div><Clock3 size={20} /><span><strong>Lähetä seurantakoodi</strong><small>Ostaja saa saman tiedon Maskines-viestinä ja sähköpostina.</small></span></div>{order.tracking_email_sent_at && <span className={styles.badge}>Viesti lähetetty</span>}</div>
            <div className={styles.trackingSendRow}>
              <label className={styles.field}><span>Postin seurantakoodi</span><input value={order.posti_tracking_code ?? ""} onChange={(event) => setOrders((current) => current.map((item) => item.id === order.id ? { ...item, posti_tracking_code: event.target.value, posti_tracking_url: null } : item))} placeholder="Esim. JJFI123456789" /></label>
              <button className={styles.button} disabled={!order.posti_tracking_code?.trim()} onClick={() => void updateOrder(order, "shipped", true)}><MailCheck size={17} /> Lähetä ostajalle</button>
            </div>
            {order.tracking_email_sent_at && <p className={styles.success}>Seurantaviesti lähetettiin {new Date(order.tracking_email_sent_at).toLocaleString("fi-FI")}.</p>}
          </div>}

          <div className={styles.statusSection}>
            <div className={styles.statusSectionHeading}><div><strong>Toimitustila</strong><span>Valitse tilauksen nykyinen vaihe</span></div></div>
            <div className={styles.statusTimeline}>{statuses.map((status, index) => {
              const isCurrent = order.fulfillment_status === status.id;
              const shippedWithoutCode = status.id === "shipped" && !order.posti_tracking_code;
              return <button type="button" key={status.id} className={isCurrent ? styles.statusStepActive : styles.statusStep} disabled={isCurrent || shippedWithoutCode} title={shippedWithoutCode ? "Lisää ensin seurantakoodi" : status.description} onClick={() => void updateOrder(order, status.id, status.id === "shipped" || status.id === "ready_for_pickup")}><span className={styles.statusStepIcon}><FulfillmentIcon status={status.id} /></span><span><strong>{status.label}</strong><small>{status.description}</small></span>{index < statuses.length - 1 && <i />}</button>;
            })}</div>
            <div className={styles.orderSecondaryStatuses}><button type="button" className={order.fulfillment_status === "attention" ? styles.statusAttentionActive : styles.statusAttention} disabled={order.fulfillment_status === "attention"} onClick={() => void updateOrder(order, "attention")}><AlertTriangle size={17} /> Vaatii huomiota</button><button type="button" className={order.fulfillment_status === "cancelled" ? styles.statusCancelledActive : styles.statusCancelled} disabled={order.fulfillment_status === "cancelled"} onClick={() => void updateOrder(order, "cancelled")}><XCircle size={17} /> Peruttu</button></div>
          </div>

          {order.shipping_method === "pickup" && order.pickup_ready_email_sent_at && <p className={styles.success}>Noutoilmoitus lähetettiin {new Date(order.pickup_ready_email_sent_at).toLocaleString("fi-FI")}.</p>}
          {order.payment_status === "paid" && <details className={styles.orderFeeDetails}><summary>Näytä maksun ja kulujen erittely</summary><div className={styles.orderFeeBreakdown}><span>Maksutapa <strong>{stripePaymentMethodLabel(order.stripe_payment_method_type)}</strong></span><span>Maskines <strong>− {money(order.maskines_fee_cents)}</strong></span><span>Stripe {order.stripe_processing_fee_cents === null ? "(kulu päivittyy)" : ""} <strong>{order.stripe_processing_fee_cents === null ? "—" : `− ${money(order.stripe_processing_fee_cents)}`}</strong></span><span>Sinulle Stripe-saldoon <strong>{order.stripe_processing_fee_cents === null ? "Päivittyy" : money(Math.max(0, order.total_cents - order.maskines_fee_cents - order.stripe_processing_fee_cents))}</strong></span></div></details>}
          </div>}
        </article>;
      })}</div>}
    </section>}
    </div>
  </div>
  </div></main>;
}
