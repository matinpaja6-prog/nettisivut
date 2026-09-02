"use client";
import UiText from "@/app/components/UiText";

import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  CircleCheck,
  CreditCard,
  LockKeyhole,
  MapPin,
  Navigation,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { trackAnalyticsEvent } from "@/lib/analytics";
import Link from "@/app/components/LocalizedLink";
import { useEffect, useMemo, useRef, useState } from "react";

import styles from "@/app/commerce.module.css";
import { clearCart, readCart, saveCart, type StoredCartItem } from "@/lib/commerce/cart";
import { activeSalePrice, hasFreeShipping } from "@/lib/commerce/discounts";
import type { PickupPoint, PublicProduct, ShippingMethod } from "@/lib/commerce/types";
import { calculateCartShippingPrice, formatPickupAddress, productSupportsPickup, productSupportsPosti } from "@/lib/commerce/validation";
import { useCurrency } from "@/app/components/CurrencyProvider";
import MarketplaceResponsibilityNotice from "@/app/components/MarketplaceResponsibilityNotice";
import { getProfile, getSafeAuthSession, getSafeAuthUser } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n";
import { profilePath } from "@/lib/routes";

type CheckoutStep = 1 | 2 | 3 | 4;
type BuyerType = "private" | "company";
type SellerChoice = { shippingMethod: ShippingMethod | null; couponInput: string; couponCode: string; couponDiscount: number };

type EmbeddedCheckoutInstance = {
  mount: (selector: string | HTMLElement) => void;
  destroy: () => void;
};

type StripeBrowserClient = {
  initEmbeddedCheckout: (options: { fetchClientSecret: () => Promise<string> }) => Promise<EmbeddedCheckoutInstance>;
};

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

const CHECKOUT_STEPS: Array<{ id: CheckoutStep; label: string; detail: string }> = [
  { id: 1, label: "Yhteenveto", detail: "Tuotteet ja hinnat" },
  { id: 2, label: "Omat tiedot", detail: "Yhteystiedot" },
  { id: 3, label: "Toimitus", detail: "Nouto tai noutopiste" },
  { id: 4, label: "Maksu", detail: "Turvallinen maksu" },
];

const NORDIC_COUNTRIES = [
  { code: "FI", name: "Suomi", postalLength: 5, postalPlaceholder: "00100", cityPlaceholder: "Helsinki" },
  { code: "SE", name: "Ruotsi", postalLength: 5, postalPlaceholder: "11122", cityPlaceholder: "Stockholm" },
  { code: "NO", name: "Norja", postalLength: 4, postalPlaceholder: "0150", cityPlaceholder: "Oslo" },
] as const;

const PICKUP_CITY_COUNTRY_HINTS: Record<string, "SE" | "NO"> = {
  haaparanta: "SE",
  haparanda: "SE",
  kiiruna: "SE",
  kiruna: "SE",
  luulaja: "SE",
  luleå: "SE",
  malmö: "SE",
  tukholma: "SE",
  stockholm: "SE",
  uumaja: "SE",
  umeå: "SE",
  oslo: "NO",
  bergen: "NO",
  tromssa: "NO",
  tromsø: "NO",
  trondheim: "NO"
};

const POPULAR_PICKUP_CITIES: Record<string, string[]> = {
  FI: ["Helsinki", "Vantaa", "Espoo", "Tampere", "Turku", "Oulu"],
  SE: ["Haaparanta", "Tukholma", "Luulaja", "Uumaja", "Göteborg", "Malmö"],
  NO: ["Oslo", "Bergen", "Trondheim", "Tromssa"]
};

function countrySettings(country: string) {
  return NORDIC_COUNTRIES.find((item) => item.code === country) ?? NORDIC_COUNTRIES[0];
}

function normalizedCountryCode(value: unknown) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("fi-FI");
  if (["se", "sweden", "sverige", "ruotsi"].includes(normalized)) return "SE";
  if (["no", "norway", "norge", "norja"].includes(normalized)) return "NO";
  return "FI";
}

function validPostalCode(value: string, country: string) {
  const { postalLength } = countrySettings(country);
  return new RegExp(`^\\d{${postalLength}}$`).test(value.replace(/\D/g, ""));
}

function deliveryProviderName(country: string) {
  if (country === "NO") return "Posten/Bring";
  if (country === "SE") return "Posti ja paikallinen kuljetuskumppani";
  return "Posti";
}

function distanceLabel(distanceInMeters: number | null | undefined, locale: "fi" | "en" | "sv" | "no") {
  if (distanceInMeters == null || !Number.isFinite(distanceInMeters)) return "";
  if (distanceInMeters < 1000) return `n. ${Math.round(distanceInMeters)} m`;
  const intlLocale = { fi: "fi-FI", en: "en-GB", sv: "sv-SE", no: "nb-NO" }[locale];
  return `n. ${new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 }).format(distanceInMeters / 1000)} km`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function CartPage() {
  const { locale } = useLanguage();
  const { formatFromEur } = useCurrency();
  const money = (cents: number) => formatFromEur(cents / 100);
  const [cart, setCart] = useState<StoredCartItem[]>([]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [step, setStep] = useState<CheckoutStep>(1);
  const [highestStep, setHighestStep] = useState<CheckoutStep>(1);
  const [sellerChoices, setSellerChoices] = useState<Record<string, SellerChoice>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerCountry, setCustomerCountry] = useState("FI");
  const [signedIn, setSignedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [buyerType, setBuyerType] = useState<BuyerType | null>(null);
  const [accountType, setAccountType] = useState<BuyerType | null>(null);
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerBusinessId, setCustomerBusinessId] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [sellerPickupPoints, setSellerPickupPoints] = useState<Record<string, PickupPoint | null>>({});
  const [pickupSearchQuery, setPickupSearchQuery] = useState("");
  const [pickupSearchCountry, setPickupSearchCountry] = useState("FI");
  const [pickupSearchArea, setPickupSearchArea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState("");
  const [paymentPublishableKey, setPaymentPublishableKey] = useState("");
  const paymentMountRef = useRef<HTMLDivElement | null>(null);
  const embeddedCheckoutRef = useRef<EmbeddedCheckoutInstance | null>(null);
  const automaticPaymentStartedRef = useRef(false);
  const pickupSearchRequestRef = useRef(0);

  useEffect(() => { setCart(readCart()); }, []);

  useEffect(() => {
    let cancelled = false;
    void getSafeAuthUser()
      .then(async (user) => {
        if (!user || cancelled) {
          setSignedIn(false);
          setBuyerType(null);
          setAccountType(null);
          return;
        }
        setSignedIn(true);
        setCustomerEmail((current) => current || user.email || "");
        const metadata = user.user_metadata ?? {};
        const metadataName = String(metadata.full_name || metadata.name || [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") || "").trim();
        setCustomerName((current) => current || metadataName);
        const metadataType: BuyerType = metadata.account_type === "company" ? "company" : "private";
        setBuyerType(metadataType);
        setAccountType(metadataType);
        setCustomerCompany(String(metadata.company_name ?? ""));
        setCustomerBusinessId(String(metadata.business_id ?? ""));
        const { data: profile } = await getProfile(user.id);
        if (!profile || cancelled) return;
        const detectedType: BuyerType = profile.account_type === "company" ? "company" : "private";
        setBuyerType(detectedType);
        setAccountType(detectedType);
        setCustomerCompany(profile.company_name ?? "");
        setCustomerBusinessId(profile.business_id ?? "");
        setCustomerName((current) => current || profile.full_name || profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(" "));
        setCustomerEmail((current) => detectedType === "company" && profile.billing_email ? profile.billing_email : current || profile.email || user.email || "");
        setCustomerPhone((current) => current || profile.phone || "");
        setCustomerAddress((current) => current || profile.address || profile.home_address || profile.postal_address || "");
        setPostalCode((current) => current || profile.postal_code || "");
        setCustomerCity((current) => current || profile.city || "");
        setCustomerCountry(normalizedCountryCode(profile.country || "FI"));
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setPickupSearchCountry(customerCountry);
  }, [customerCountry]);

  useEffect(() => {
    if (!paymentClientSecret || !paymentPublishableKey || !paymentMountRef.current) return;
    let cancelled = false;

    void loadStripeJs()
      .then(async () => {
        if (cancelled || !window.Stripe || !paymentMountRef.current) return;
        embeddedCheckoutRef.current?.destroy();
        const stripe = window.Stripe(paymentPublishableKey);
        const checkoutInstance = await stripe.initEmbeddedCheckout({
          fetchClientSecret: async () => paymentClientSecret
        });
        if (cancelled || !paymentMountRef.current) {
          checkoutInstance.destroy();
          return;
        }
        embeddedCheckoutRef.current = checkoutInstance;
        checkoutInstance.mount(paymentMountRef.current);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Maksusivun avaaminen epäonnistui.");
      });

    return () => {
      cancelled = true;
      embeddedCheckoutRef.current?.destroy();
      embeddedCheckoutRef.current = null;
    };
  }, [paymentClientSecret, paymentPublishableKey]);

  useEffect(() => {
    if (!cart.length) { setProducts([]); setLoading(false); return; }
    let cancelled = false;
    let refreshing = false;

    async function validateCart() {
      if (refreshing) return;
      refreshing = true;
      try {
        const results = await Promise.all(cart.map(async (item) => {
          const response = await fetch(`/api/commerce/catalog/${encodeURIComponent(item.productId)}`, { cache: "no-store" });
          const body = await response.json().catch(() => ({})) as { product?: PublicProduct; error?: string };
          if (response.status === 404) return { item, product: null };
          if (!response.ok) throw new Error(body.error || "Ostoskorin tarkistus epäonnistui.");
          return { item, product: body.product ?? null };
        }));
        if (cancelled) return;

        const validResults = results.filter(
          (result): result is { item: StoredCartItem; product: PublicProduct } => Boolean(result.product),
        );
        const nextCart = validResults.map(({ item, product }) => ({
          ...item,
          quantity: Math.max(1, Math.min(item.quantity, product.stock_quantity)),
        }));
        const cartChanged = JSON.stringify(nextCart) !== JSON.stringify(cart);
        const removedCount = cart.length - validResults.length;

        setProducts(validResults.map((result) => result.product));
        if (removedCount > 0) {
          setCartNotice(removedCount === 1
            ? "Myyty tai myynnistä poistettu tuote poistettiin ostoskoristasi."
            : `${removedCount} myytyä tai myynnistä poistettua tuotetta poistettiin ostoskoristasi.`);
        }
        if (cartChanged) { saveCart(nextCart); setCart(nextCart); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        refreshing = false;
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    void validateCart();
    const handleFocus = () => void validateCart();
    const handleVisibility = () => { if (document.visibilityState === "visible") void validateCart(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [cart]);

  const lines = useMemo(() => cart
    .map((item) => ({ product: products.find((product) => product.id === item.productId), quantity: item.quantity }))
    .filter((line): line is { product: PublicProduct; quantity: number } => Boolean(line.product)), [cart, products]);
  const sellerGroups = useMemo(() => Array.from(new Set(lines.map(({ product }) => product.company_id))).map((companyId) => {
    const sellerLines = lines.filter(({ product }) => product.company_id === companyId);
    const sellerProductTotal = sellerLines.reduce((sum, line) => sum + activeSalePrice(line.product) * line.quantity, 0);
    return {
      companyId,
      company: sellerLines[0].product.company,
      lines: sellerLines,
      allPickup: sellerLines.every(({ product }) => productSupportsPickup(product)),
      allPosti: sellerLines.every(({ product }) => productSupportsPosti(product)),
      productTotal: sellerProductTotal
    };
  }), [lines]);
  const company = lines[0]?.product.company;

  useEffect(() => {
    setSellerChoices((current) => {
      const next = { ...current };
      let changed = false;
      for (const group of sellerGroups) {
        if (!next[group.companyId]) {
          changed = true;
          next[group.companyId] = {
            shippingMethod: null,
            couponInput: "", couponCode: "", couponDiscount: 0
          };
        }
      }
      return changed ? next : current;
    });
  }, [sellerGroups]);

  useEffect(() => {
    setSellerChoices((current) => {
      const next = { ...current };
      let changed = false;
      for (const group of sellerGroups) {
        const choice = next[group.companyId];
        if (!choice || choice.shippingMethod === "pickup") continue;
        const countries = group.company.shipping_countries?.length ? group.company.shipping_countries : ["FI"];
        const carrierEnabled = group.company.posti_enabled;
        if (!countries.includes(customerCountry) || !carrierEnabled) {
          changed = true;
          next[group.companyId] = { ...choice, shippingMethod: null };
        }
      }
      return changed ? next : current;
    });
    setPoints([]);
    setSellerPickupPoints({});
  }, [customerCountry, sellerGroups]);

  useEffect(() => {
    if (step !== 3 || !sellerGroups.some((group) => sellerChoices[group.companyId]?.shippingMethod === "posti") || points.length || loadingPoints) return;
    if (!customerAddress.trim() || !validPostalCode(postalCode, customerCountry) || !customerCity.trim()) return;
    void searchPoints();
  }, [step, customerCountry, sellerChoices, sellerGroups]);

  const sellerTotals = sellerGroups.map((group) => {
    const choice = sellerChoices[group.companyId];
    const afterCoupon = Math.max(0, group.productTotal - (choice?.couponDiscount ?? 0));
    const postiBaseShipping = calculateCartShippingPrice(group.lines, group.company.shipping_price_strategy, customerCountry);
    const postiShipping = hasFreeShipping(group.company.free_shipping_threshold_cents, afterCoupon) ? 0 : postiBaseShipping;
    const shipping = choice?.shippingMethod === "posti" ? postiShipping : 0;
    return { ...group, choice, afterCoupon, postiShipping, shipping, total: afterCoupon + shipping };
  });
  const postiSellerTotals = sellerTotals.filter((group) => group.choice?.shippingMethod === "posti");
  const allowedPickupCountries = NORDIC_COUNTRIES.filter((country) =>
    postiSellerTotals.length === 0 || postiSellerTotals.every((group) =>
      (group.company.shipping_countries?.length ? group.company.shipping_countries : ["FI"]).includes(country.code)
    )
  );
  const effectivePickupSearchCountry = allowedPickupCountries.some((country) => country.code === pickupSearchCountry)
    ? pickupSearchCountry
    : allowedPickupCountries[0]?.code ?? "FI";
  const productTotal = sellerGroups.reduce((sum, group) => sum + group.productTotal, 0);
  const couponTotal = sellerTotals.reduce((sum, group) => sum + (group.choice?.couponDiscount ?? 0), 0);
  const shippingPrice = sellerTotals.reduce((sum, group) => sum + group.shipping, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const pickupRows = lines.map(({ product }) => ({
    id: product.id,
    name: product.name,
    address: product.pickup_address_override || formatPickupAddress(product.company) || "Tarkka nouto-osoite lähetetään maksun jälkeen.",
    instructions: product.pickup_instructions,
  }));
  const differentPickupAddresses = new Set(pickupRows.map((row) => row.address)).size > 1;
  useEffect(() => {
    if (step !== 4 || paymentClientSecret || automaticPaymentStartedRef.current) return;
    automaticPaymentStartedRef.current = true;
    void checkout();
  }, [step, paymentClientSecret]);

  function setQuantity(productId: string, quantity: number) {
    const product = products.find((candidate) => candidate.id === productId);
    const next = cart.map((item) => item.productId === productId
      ? { ...item, quantity: Math.max(1, Math.min(product?.stock_quantity ?? 999, Math.trunc(quantity) || 1)) }
      : item);
    saveCart(next);
    setCart(next);
  }

  function remove(productId: string) {
    const next = cart.filter((item) => item.productId !== productId);
    saveCart(next);
    setCart(next);
  }

  function updateSellerChoice(companyId: string, updates: Partial<SellerChoice>) {
    setSellerChoices((current) => ({
      ...current,
      [companyId]: { ...(current[companyId] ?? { shippingMethod: null, couponInput: "", couponCode: "", couponDiscount: 0 }), ...updates }
    }));
  }

  async function applyCoupon(companyId: string, subtotalCents: number) {
    const code = sellerChoices[companyId]?.couponInput.trim() ?? "";
    if (!code) return;
    setError("");
    try {
      const response = await fetch("/api/commerce/discounts/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, code, subtotalCents }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Alennuskoodi ei kelpaa.");
      updateSellerChoice(companyId, { couponCode: body.code, couponInput: body.code, couponDiscount: body.amountCents });
    } catch (reason) {
      updateSellerChoice(companyId, { couponCode: "", couponDiscount: 0 });
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function openStep(nextStep: CheckoutStep) {
    if (nextStep > highestStep) return;

    if (nextStep < 4 && paymentClientSecret) {
      embeddedCheckoutRef.current?.destroy();
      embeddedCheckoutRef.current = null;
      setPaymentClientSecret("");
      setPaymentPublishableKey("");
      automaticPaymentStartedRef.current = false;
    }

    setError("");
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueTo(nextStep: CheckoutStep) {
    setError("");
    if (step === 1 && sellerGroups.length !== 1) {
      setError("Eri yritysten tuotteet maksetaan erikseen. Jätä ostoskoriin yhden yrityksen tuotteet ja maksa muiden yritysten tuotteet omana tilauksenaan.");
      return;
    }
    if (step === 2 && !buyerType) {
      setError("Valitse, ostatko yksityishenkilönä vai yrityksenä.");
      return;
    }
    if (step === 2 && buyerType === "company" && (!signedIn || accountType !== "company")) {
      setError("Yrityksenä ostaminen vaatii kirjautumisen yritystilille.");
      return;
    }
    if (step === 2 && buyerType === "company" && (!customerCompany.trim() || !customerBusinessId.trim())) {
      setError("Täydennä yrityksen nimi ja Y-tunnus yritystilillesi ennen jatkamista.");
      return;
    }
    if (step === 2 && (!customerName.trim() || !validEmail(customerEmail) || !customerPhone.trim() || !customerAddress.trim() || !validPostalCode(postalCode, customerCountry) || !customerCity.trim())) {
      setError("Täytä nimi, yhteystiedot ja koko toimitusosoite ennen jatkamista.");
      return;
    }
    const invalidSellerDelivery = sellerTotals.find((group) => !group.choice?.shippingMethod ||
      (group.choice.shippingMethod === "pickup" && !group.allPickup) ||
      (group.choice.shippingMethod === "posti" && (!group.allPosti || !sellerPickupPoints[group.companyId])));
    if (step === 3 && invalidSellerDelivery) {
      const needsPoint = invalidSellerDelivery.choice?.shippingMethod === "posti" && !sellerPickupPoints[invalidSellerDelivery.companyId];
      setError(`Valitse yritykselle ${invalidSellerDelivery.company.name} ${needsPoint ? "oma noutopiste" : "toimitustapa"}.`);
      return;
    }
    setHighestStep((current) => Math.max(current, nextStep) as CheckoutStep);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function searchPoints(locationQuery = "", countryOverride?: string) {
    const requestId = pickupSearchRequestRef.current + 1;
    pickupSearchRequestRef.current = requestId;
    const normalizedQuery = locationQuery.trim();
    const hintedCountry = PICKUP_CITY_COUNTRY_HINTS[normalizedQuery.toLocaleLowerCase("fi-FI")];
    const searchCountry = normalizedQuery
      ? hintedCountry ?? countryOverride ?? pickupSearchCountry
      : countryOverride ?? customerCountry;
    const queryIsPostalCode = validPostalCode(normalizedQuery, searchCountry);
    const queryIsCity = /^[\p{L}\s.'-]{2,100}$/u.test(normalizedQuery);
    setError("");
    setPoints([]);
    setSellerPickupPoints({});
    if (normalizedQuery && !queryIsPostalCode && !queryIsCity) {
      setError(`Hae ${countrySettings(searchCountry).postalLength}-numeroisella postinumerolla tai kaupungin nimellä.`);
      return;
    }
    if (!normalizedQuery && (!customerAddress.trim() || !validPostalCode(postalCode.trim(), customerCountry) || !customerCity.trim())) {
      setError("Täytä ensin ostajan koko osoite.");
      return;
    }
    setLoadingPoints(true);
    try {
      const query = new URLSearchParams();
      query.set("country", searchCountry);
      if (queryIsPostalCode) query.set("postal_code", normalizedQuery);
      else if (queryIsCity) query.set("city", normalizedQuery);
      else {
        query.set("postal_code", postalCode);
        query.set("street", customerAddress);
        query.set("city", customerCity);
      }
      if (customerAddress.trim() && customerCity.trim() && validPostalCode(postalCode.trim(), customerCountry)) {
        query.set("origin_street", customerAddress.trim());
        query.set("origin_postal_code", postalCode.trim());
        query.set("origin_city", customerCity.trim());
        query.set("origin_country", customerCountry);
      }
      const response = await fetch(`/api/commerce/posti/pickup-points?${query.toString()}`);
      const body = await response.json().catch(() => null) as { error?: string; pickupPoints?: PickupPoint[] } | null;
      if (requestId !== pickupSearchRequestRef.current) return;
      if (!response.ok) {
        setError(body?.error || "Noutopisteiden haku ei juuri nyt onnistu. Yritä hetken kuluttua uudelleen.");
        return;
      }
      const nextPoints = body?.pickupPoints ?? [];
      setPoints(nextPoints);
      setPickupSearchCountry(searchCountry);
      setPickupSearchArea(`${normalizedQuery || `${customerAddress}, ${postalCode} ${customerCity}`} · ${countrySettings(searchCountry).name}`);
      if (!nextPoints.length) setError("Hakualueelta ei löytynyt noutopisteitä.");
    } catch {
      if (requestId !== pickupSearchRequestRef.current) return;
      setError("Noutopisteiden haku ei juuri nyt onnistu. Yritä hetken kuluttua uudelleen.");
    } finally {
      if (requestId === pickupSearchRequestRef.current) setLoadingPoints(false);
    }
  }

  async function checkout() {
    setError("");
    setSubmitting(true);
    try {
      const session = await getSafeAuthSession();
      const response = await fetch("/api/commerce/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          locale,
          items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          customerName,
          customerEmail,
          customerPhone,
          customerAddress,
          customerPostalCode: postalCode,
          customerCity,
          customerCountry,
          buyerType,
          customerCompany: buyerType === "company" ? customerCompany : undefined,
          customerBusinessId: buyerType === "company" ? customerBusinessId : undefined,
          sellerSelections: sellerTotals.map((group) => ({
            companyId: group.companyId,
            shippingMethod: group.choice?.shippingMethod,
            pickupPoint: group.choice?.shippingMethod === "posti" ? sellerPickupPoints[group.companyId] ?? null : null,
            discountCode: group.choice?.couponCode || undefined
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) setCart([...cart]);
        throw new Error(body.error || "Maksuun siirtyminen epäonnistui.");
      }
      if (!body.clientSecret || !body.publishableKey) {
        throw new Error("Upotetun maksusivun tiedot puuttuvat.");
      }
      trackAnalyticsEvent("begin_checkout", { item_count: cart.reduce((total, item) => total + item.quantity, 0), currency: "EUR" });
      setPaymentClientSecret(body.clientSecret);
      setPaymentPublishableKey(body.publishableKey);
      setSubmitting(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      automaticPaymentStartedRef.current = false;
      setSubmitting(false);
    }
  }

  if (loading) return <main className={`${styles.page} ${styles.cartWizardPage}`}><div className={styles.cartLoading}><ShoppingBag size={30} /><span><UiText text={"Ladataan ostoskoria…"} /></span></div></main>;
  if (!cart.length) return <main className={`${styles.page} ${styles.cartWizardPage} ${styles.cartEmptyPage}`}><div className={styles.cartEmptyBare}><ShoppingCart size={52} strokeWidth={2.2} /><h1><UiText text={"Ostoskorisi on tyhjä"} /></h1>{cartNotice && <p className={styles.warning}>{cartNotice}</p>}<Link href="/ilmoitukset"><UiText text={"Jatka ostoksia"} /></Link></div></main>;

  return (
    <main className={`${styles.page} ${styles.cartWizardPage}`}>
      <div className={`${styles.shell} ${styles.cartWizardShell}`}>
        <header className={styles.cartWizardHero}>
          <div>
            <Link className={styles.cartBackLink} href={company ? profilePath(company.owner_user_id, company.name, "fi") : "/ilmoitukset"}><ArrowLeft size={16} /><UiText text={" Jatka ostoksia"} /></Link>
            <div className={styles.eyebrow}><UiText text={"Maskines turvallinen kassa"} /></div>
            <h1><UiText text={"Viimeistele tilauksesi"} /></h1>
            <p>{sellerGroups.length} {sellerGroups.length === 1 ? "yritys" : "yritystä"} · {itemCount} {itemCount === 1 ? "tuote" : "tuotetta"}</p>
          </div>
          <div className={styles.cartTrustRow}><span><ShieldCheck size={16} /><UiText text={" Vahvistettu myyjä"} /></span><span><LockKeyhole size={16} /><UiText text={" Suojattu maksu"} /></span></div>
        </header>

        <nav className={styles.checkoutProgress} aria-label="Kassan vaiheet">
          {CHECKOUT_STEPS.map((item) => {
            const active = step === item.id;
            const complete = highestStep > item.id;
            const locked = item.id > highestStep;
            return <button
              type="button"
              key={item.id}
              disabled={locked}
              aria-current={active ? "step" : undefined}
              aria-label={locked ? `${item.label}, ei vielä käytettävissä` : active ? `${item.label}, nykyinen vaihe` : `Siirry vaiheeseen ${item.label}`}
              title={locked ? "Täytä aiemmat vaiheet ensin" : active ? "Nykyinen vaihe" : `Siirry vaiheeseen ${item.label}`}
              className={active ? styles.checkoutProgressActive : complete ? styles.checkoutProgressComplete : styles.checkoutProgressStep}
              onClick={() => openStep(item.id)}
            ><span>{complete ? <Check size={17} /> : item.id}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div>{item.id < 4 && <ChevronRight size={17} />}</button>;
          })}
        </nav>

        <div className={styles.cartLayout}>
          <div className={styles.cartMain}>
            {step === 1 && <section className={`${styles.panel} ${styles.checkoutStage}`}>
              <div className={styles.checkoutStageHeader}><span><ShoppingBag size={22} /></span><div><div className={styles.eyebrow}><UiText text={"Vaihe 1 / 4"} /></div><h2><UiText text={"Tarkista tilauksesi"} /></h2><p><UiText text={"Varmista tuotteet, määrät ja hinnat ennen jatkamista."} /></p></div></div>
              {sellerGroups.length > 1 && <p className={styles.warning}><UiText text={"Maksut tehdään yrityskohtaisesti, jotta kauppasumma, Stripe-kulut ja palautusvastuu kuuluvat suoraan oikealle myyjälle. Jätä tähän tilaukseen yhden yrityksen tuotteet."} /></p>}
              <div className={styles.cartSellerGroups}>{sellerGroups.map((group) => <section className={styles.cartSellerGroup} key={group.companyId}>
                <header><div><Store size={18} /><span><small><UiText text={"Myyjä"} /></small><strong>{group.company.name}</strong></span></div><span>{group.lines.length}<UiText text={" tuoteriviä"} /></span></header>
                <div className={styles.cartLines}>{group.lines.map(({ product, quantity }) => { const unitPrice = activeSalePrice(product); return <article className={styles.cartLine} key={product.id}>
                  <Link className={styles.cartImageWrap} href={`/tuotteet/${product.id}`}>{product.image_urls?.[0] ? <Image src={product.image_urls[0]} width={176} height={144} alt={product.name} unoptimized /> : <PackageCheck size={34} />}</Link>
                  <div className={styles.cartLineInfo}><div><Link href={`/tuotteet/${product.id}`}>{product.name}</Link><p>{unitPrice < product.price_cents && <del>{money(product.price_cents)}</del>} {money(unitPrice)}<UiText text={" / kpl"} /></p></div><div className={styles.cartDeliveryTags}>{productSupportsPickup(product) && <span><MapPin size={13} /><UiText text={" Nouto"} /></span>}{productSupportsPosti(product) && <span><Truck size={13} /><UiText text={" Posti"} /></span>}</div></div>
                  <div className={`${styles.cartLineActions} ${product.stock_quantity <= 1 ? styles.cartLineActionsSingle : ""}`}>{product.stock_quantity > 1 && <div className={`${styles.quantityStepper} ${quantity >= product.stock_quantity ? styles.quantityStepperMax : ""}`} aria-label={`Tuotteen ${product.name} määrä`}><button type="button" aria-label="Vähennä määrää" onClick={() => setQuantity(product.id, quantity - 1)}><Minus size={15} /></button><input type="number" min={1} max={product.stock_quantity} value={quantity} aria-label="Määrä" onChange={(event) => setQuantity(product.id, Number(event.target.value))} />{quantity < product.stock_quantity && <button type="button" aria-label="Lisää määrää" onClick={() => setQuantity(product.id, quantity + 1)}><Plus size={15} /></button>}</div>}<strong>{money(unitPrice * quantity)}</strong><button type="button" className={styles.cartRemove} onClick={() => remove(product.id)}><Trash2 size={15} /><UiText text={" Poista"} /></button></div>
                </article>; })}</div>
                <div className={styles.sellerCoupon}><div><strong><UiText text={"Onko sinulla yrityksen alekoodi?"} /></strong><small><UiText text={"Koodi koskee vain yrityksen "} />{group.company.name}<UiText text={" tuotteita."} /></small></div><form onSubmit={(event) => { event.preventDefault(); void applyCoupon(group.companyId, group.productTotal); }}><input value={sellerChoices[group.companyId]?.couponInput ?? ""} onChange={(event) => updateSellerChoice(group.companyId, { couponInput: event.target.value, couponCode: "", couponDiscount: 0 })} placeholder="ALEKOODI" /><button type="submit"><UiText text={"Käytä"} /></button></form>{Boolean(sellerChoices[group.companyId]?.couponDiscount) && <span className={styles.couponSuccess}><Check size={15} /> {sellerChoices[group.companyId].couponCode}: −{money(sellerChoices[group.companyId].couponDiscount)}</span>}</div>
              </section>)}</div>
            </section>}

            {step === 2 && <section className={`${styles.panel} ${styles.checkoutStage}`}>
              <div className={styles.checkoutStageHeader}><span><UserRound size={22} /></span><div><div className={styles.eyebrow}><UiText text={"Vaihe 2 / 4"} /></div><h2><UiText text={"Ostajan tiedot"} /></h2><p><UiText text={"Kuitti, tilausvahvistus ja toimitusviestit lähetetään näillä tiedoilla."} /></p></div></div>
              {authChecked && !signedIn && <div className={styles.checkoutBuyerType}>
                <div className={styles.checkoutBuyerTypeHeading}><strong><UiText text={"Kuka tekee tilauksen?"} /></strong><p><UiText text={"Yksityishenkilö voi tilata ilman tiliä. Yritysosto vaatii yritystilin."} /></p></div>
                <div className={styles.checkoutBuyerTypeGrid}>
                  <button type="button" className={buyerType === "private" ? styles.checkoutBuyerTypeActive : styles.checkoutBuyerTypeOption} onClick={() => setBuyerType("private")}><span><UserRound size={21} /></span><div><strong><UiText text={"Yksityishenkilö"} /></strong><small><UiText text={"Jatka ilman käyttäjätiliä"} /></small></div>{buyerType === "private" && <Check size={17} />}</button>
                  <button type="button" className={buyerType === "company" ? styles.checkoutBuyerTypeActive : styles.checkoutBuyerTypeOption} onClick={() => setBuyerType("company")}><span><Building2 size={21} /></span><div><strong><UiText text={"Yritys"} /></strong><small><UiText text={"Kirjaudu tai luo yritystili"} /></small></div>{buyerType === "company" && <Check size={17} />}</button>
                </div>
              </div>}
              {authChecked && signedIn && <div className={styles.checkoutIdentityReady}><Check size={18} /><div><strong>{buyerType === "company" ? "Tunnistettu yritysostajaksi" : "Tunnistettu yksityisasiakkaaksi"}</strong><p><UiText text={"Ostajatyyppi ja yhteystiedot haettiin automaattisesti tililtäsi."} /></p></div></div>}
              {authChecked && !signedIn && buyerType === "company" && <div className={styles.checkoutCompanyRequired}><Building2 size={22} /><div><strong><UiText text={"Yritysosto vaatii yritystilin"} /></strong><p><UiText text={"Luo yritystili tai kirjaudu olemassa olevalle yritystilille. Yrityksen tiedot tunnistetaan sen jälkeen automaattisesti."} /></p></div><div><Link href={`/auth?mode=register&account=company&next=${encodeURIComponent("/ostoskori")}`}><UiText text={"Luo yritystili"} /></Link><Link href={`/auth?next=${encodeURIComponent("/ostoskori")}`}><UiText text={"Kirjaudu"} /></Link></div></div>}
              {authChecked && !signedIn && buyerType === "private" && <div className={styles.checkoutIdentityGuest}><UserRound size={19} /><div><strong><UiText text={"Voit jatkaa ilman Maskines-tiliä"} /></strong><p><UiText text={"Halutessasi voit kirjautua, jolloin tallennetut tietosi täytetään automaattisesti."} /></p></div><Link href={`/auth?next=${encodeURIComponent("/ostoskori")}`}><UiText text={"Kirjaudu"} /></Link></div>}
              {buyerType === "private" || (buyerType === "company" && signedIn && accountType === "company") ? <>
              {buyerType === "company" && <div className={styles.checkoutFormSection}>
                <div className={styles.checkoutFormTitle}><Building2 size={17} /><div><strong><UiText text={"Yrityksen tiedot"} /></strong><small><UiText text={"Tiedot haetaan vahvistetulta yritystililtä"} /></small></div></div>
                <div className={styles.formGrid}>
                  <label className={styles.field}><span><UiText text={"Yrityksen nimi *"} /></span><input autoComplete="organization" value={customerCompany} readOnly aria-readonly="true" /></label>
                  <label className={styles.field}><span><UiText text={"Y-tunnus *"} /></span><input value={customerBusinessId} readOnly aria-readonly="true" /></label>
                </div>
                <div className={styles.checkoutCompanySource}><LockKeyhole size={14} /><span><UiText text={"Yritystiedot on lukittu tälle tilille."} /></span><Link href="/profile#yritys"><UiText text={"Muokkaa yritystilillä"} /></Link></div>
              </div>}
              <div className={styles.checkoutFormSection}>
                <div className={styles.checkoutFormTitle}><UserRound size={17} /><div><strong>{buyerType === "company" ? "Yrityksen yhteyshenkilö" : "Yhteystiedot"}</strong><small>{buyerType === "company" ? "Tilauksesta vastaavan henkilön tiedot" : "Tilausvahvistusta ja toimitusilmoituksia varten"}</small></div></div>
                <div className={styles.formGrid}>
                  <label className={styles.field}><span>{buyerType === "company" ? "Yhteyshenkilön nimi *" : "Etu- ja sukunimi *"}</span><input autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Matti Meikäläinen" /></label>
                  <label className={styles.field}><span>{buyerType === "company" ? "Yrityksen sähköposti *" : "Sähköposti *"}</span><input type="email" autoComplete="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="nimi@esimerkki.fi" /></label>
                  <label className={styles.fieldFull}><span>{buyerType === "company" ? "Yrityksen puhelinnumero *" : "Puhelinnumero *"}</span><input autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+358 40 123 4567" /></label>
                </div>
              </div>
              <div className={styles.checkoutFormSection}>
                <div className={styles.checkoutFormTitle}><MapPin size={17} /><div><strong>{buyerType === "company" ? "Yrityksen toimitusosoite" : "Toimitusosoite"}</strong><small>{buyerType === "company" ? "Toimitus ja noutopisteet haetaan yrityksen antaman osoitteen perusteella" : "Noutopisteet haetaan koko osoitteen läheltä"}</small></div></div>
                <div className={styles.formGrid}>
                  <label className={styles.fieldFull}><span><UiText text={"Katuosoite *"} /></span><input autoComplete="street-address" value={customerAddress} onChange={(event) => { setCustomerAddress(event.target.value); setPoints([]); setSellerPickupPoints({}); }} placeholder="Esimerkkikatu 12 A 4" /></label>
                  <label className={styles.field}><span><UiText text={"Postinumero *"} /></span><input autoComplete="postal-code" inputMode="numeric" maxLength={countrySettings(customerCountry).postalLength} value={postalCode} onChange={(event) => { setPostalCode(event.target.value.replace(/\D/g, "").slice(0, countrySettings(customerCountry).postalLength)); setPoints([]); setSellerPickupPoints({}); }} placeholder={countrySettings(customerCountry).postalPlaceholder} /></label>
                  <label className={styles.field}><span><UiText text={"Kaupunki *"} /></span><input autoComplete="address-level2" value={customerCity} onChange={(event) => { setCustomerCity(event.target.value); setPoints([]); setSellerPickupPoints({}); }} placeholder={countrySettings(customerCountry).cityPlaceholder} /></label>
                  <label className={styles.fieldFull}><span><UiText text={"Maa *"} /></span><select autoComplete="country" value={customerCountry} onChange={(event) => { setCustomerCountry(event.target.value); setPostalCode(""); setPoints([]); setSellerPickupPoints({}); setPickupSearchQuery(""); setPickupSearchArea(""); }}>{NORDIC_COUNTRIES.map((country) => <option value={country.code} key={country.code}>{country.name}</option>)}</select></label>
                </div>
              </div>
              </> : null}
            </section>}

            {step === 3 && <section className={`${styles.panel} ${styles.checkoutStage}`}>
              <div className={styles.checkoutStageHeader}><span><Truck size={22} /></span><div><div className={styles.eyebrow}><UiText text={"Vaihe 3 / 4"} /></div><h2><UiText text={"Valitse toimitustapa"} /></h2><p><UiText text={"Valitse toimitustapa erikseen jokaiselle yritykselle. Postitoimitukselle valitaan myös yrityskohtainen noutopiste."} /></p></div></div>
              <div className={styles.sellerDeliveryGroups}>{sellerTotals.map((group) => <section className={styles.sellerDeliveryGroup} key={group.companyId}><header><Store size={18} /><div><small><UiText text={"Yrityksen toimitus"} /></small><strong>{group.company.name}</strong></div><span>{money(group.productTotal)}</span></header><div className={styles.deliveryOptions}>
                {group.allPickup && <label className={group.choice?.shippingMethod === "pickup" ? styles.deliveryOptionActive : styles.deliveryOption}><input type="radio" name={`shipping-${group.companyId}`} checked={group.choice?.shippingMethod === "pickup"} onChange={() => { updateSellerChoice(group.companyId, { shippingMethod: "pickup" }); setSellerPickupPoints((current) => ({ ...current, [group.companyId]: null })); }} /><span className={styles.deliveryRadio}>{group.choice?.shippingMethod === "pickup" && <Check size={13} />}</span><span className={styles.deliveryIcon}><MapPin size={21} /></span><span className={styles.deliveryOptionCopy}><strong><UiText text={"Nouto yritykseltä"} /></strong><small>{formatPickupAddress(group.company) || "Tarkka osoite lähetetään maksun jälkeen"}</small></span><b><UiText text={"Maksuton"} /></b></label>}
                {group.allPosti && group.company.posti_enabled && (group.company.shipping_countries?.length ? group.company.shipping_countries : ["FI"]).includes(customerCountry) && <label className={group.choice?.shippingMethod === "posti" ? styles.deliveryOptionActive : styles.deliveryOption}><input type="radio" name={`shipping-${group.companyId}`} checked={group.choice?.shippingMethod === "posti"} onChange={() => updateSellerChoice(group.companyId, { shippingMethod: "posti" })} /><span className={styles.deliveryRadio}>{group.choice?.shippingMethod === "posti" && <Check size={13} />}</span><span className={styles.deliveryIcon}><Truck size={21} /></span><span className={styles.deliveryOptionCopy}><strong>{deliveryProviderName(customerCountry)}<UiText text={" – noutopiste"} /></strong><small><UiText text={"Valitse tälle yritykselle oma noutopiste alta."} /></small>{group.company.free_shipping_threshold_cents && <em><UiText text={"Ilmainen yli "} />{money(group.company.free_shipping_threshold_cents)}<UiText text={" tilauksiin."} /></em>}</span><b>{group.postiShipping === 0 ? "Maksuton" : money(group.postiShipping)}</b></label>}
              </div></section>)}</div>
              {sellerTotals.some((group) => group.choice?.shippingMethod === "pickup") && <div className={styles.deliveryDetails}><h3><UiText text={"Noutotiedot"} /></h3>{differentPickupAddresses && <p className={styles.warning}><UiText text={"Tilauksessa on tuotteita, joilla on eri nouto-osoitteet."} /></p>}<div className={styles.pickupGrid}>{pickupRows.filter((row) => sellerChoices[lines.find((line) => line.product.id === row.id)?.product.company_id ?? ""]?.shippingMethod === "pickup").map((row) => <div className={styles.pickupCard} key={row.id}><MapPin size={18} /><div><strong>{row.name}</strong><p>{row.address}</p>{row.instructions && <small>{row.instructions}</small>}</div></div>)}</div></div>}
              {postiSellerTotals.length > 0 && <div className={styles.deliveryDetails}>
                <div className={styles.pickupSectionHeader}><div><h3><UiText text={"Postin lähimmät noutopisteet"} /></h3><p><Navigation size={14} /> {customerAddress}, {postalCode} {customerCity}, {countrySettings(customerCountry).name}</p></div><button className={styles.buttonSecondary} type="button" disabled={loadingPoints} onClick={() => { setPickupSearchQuery(""); setPickupSearchCountry(customerCountry); void searchPoints("", customerCountry); }}>{loadingPoints ? "Haetaan…" : "Hae omalla osoitteella"}</button></div>
                {loadingPoints && <div className={styles.pickupLoading}><Navigation size={19} /><UiText text={" Etsitään lähimpiä noutopisteitä…"} /></div>}
                {!loadingPoints && <>
                  <form className={styles.pickupFilter} onSubmit={(event) => { event.preventDefault(); void searchPoints(pickupSearchQuery, effectivePickupSearchCountry); }}><Search size={17} /><input type="search" value={pickupSearchQuery} onChange={(event) => setPickupSearchQuery(event.target.value)} placeholder="Postinumero tai kaupunki" aria-label="Hae postinumerolla tai kaupungilla" /><select value={effectivePickupSearchCountry} onChange={(event) => { const nextCountry = event.target.value; const defaultCity = nextCountry === customerCountry && customerCity.trim() ? customerCity.trim() : POPULAR_PICKUP_CITIES[nextCountry]?.[0] ?? ""; setPickupSearchCountry(nextCountry); setPickupSearchQuery(defaultCity); setPoints([]); setSellerPickupPoints({}); if (defaultCity) void searchPoints(defaultCity, nextCountry); }} aria-label="Noutopistehaun maa">{allowedPickupCountries.map((country) => <option value={country.code} key={country.code}>{country.name}</option>)}</select><button type="submit" disabled={loadingPoints}><UiText text={"Hae"} /></button></form>
                  <div className={styles.pickupResultMeta}><span>{points.length} {points.length === 1 ? "noutopiste" : "noutopistettä"}</span>{pickupSearchArea && <small><UiText text={"Hakualue: "} />{pickupSearchArea}</small>}</div>
                  {points.length > 0 ? <div className={styles.pickupSellerSelections}>{postiSellerTotals.map((group) => { const selectedPoint = sellerPickupPoints[group.companyId]; return <section className={styles.pickupSellerSelection} key={group.companyId}><header><Store size={17} /><div><small><UiText text={"Toimitus yritykseltä"} /></small><strong>{group.company.name}</strong></div><span>{selectedPoint ? "Noutopiste valittu" : "Valitse noutopiste"}</span></header><div className={styles.pickupPointList}>{points.map((candidate) => <label className={selectedPoint?.id === candidate.id ? styles.pickupPointActive : styles.pickupPoint} key={candidate.id}><input type="radio" name={`point-${group.companyId}`} checked={selectedPoint?.id === candidate.id} onChange={() => setSellerPickupPoints((current) => ({ ...current, [group.companyId]: candidate }))} /><span className={styles.pickupPointCheck}>{selectedPoint?.id === candidate.id ? <Check size={13} /> : <MapPin size={15} />}</span><span className={styles.pickupPointCopy}><span><strong>{candidate.name}</strong>{candidate.parcelLocker != null && <em>{candidate.parcelLocker ? "Pakettiautomaatti" : "Palvelupiste"}</em>}</span><small>{candidate.address}</small></span>{distanceLabel(candidate.distanceInMeters, locale) && <b title="Arvioitu linnuntie-etäisyys ostajan osoitteesta">{distanceLabel(candidate.distanceInMeters, locale)}</b>}</label>)}</div></section>; })}</div> : <div className={styles.pickupEmptySearch}><Search size={21} /><strong><UiText text={"Noutopisteitä ei löytynyt"} /></strong><span><UiText text={"Hae toisella postinumerolla tai kaupungilla."} /></span></div>}
                </>}
              </div>}
            </section>}

            {step === 4 && <section className={`${styles.panel} ${styles.checkoutStage}`}>
              <div className={styles.checkoutStageHeader}><span><CreditCard size={22} /></span><div><div className={styles.eyebrow}><UiText text={"Vaihe 4 / 4"} /></div><h2><UiText text={"Maksu"} /></h2><p><UiText text={"Tarkista tilaus ja valitse sinulle sopiva maksutapa turvallisesti tällä sivulla."} /></p></div></div>
              <div className={styles.checkoutPaymentReview}>
                <div className={styles.checkoutPaymentProducts}><h3><UiText text={"Tilauksen sisältö"} /></h3>{sellerTotals.map((group) => <section key={group.companyId}><header><strong>{group.company.name}</strong><small>{group.choice?.shippingMethod === "posti" ? `${deliveryProviderName(customerCountry)} · ${group.shipping === 0 ? "maksuton" : money(group.shipping)}` : "Nouto · maksuton"}</small></header>{group.lines.map(({ product, quantity }) => { const unit = activeSalePrice(product); return <div key={product.id}><span>{product.name}<small>{quantity}<UiText text={" × "} />{money(unit)}</small></span><strong>{money(unit * quantity)}</strong></div>; })}{Boolean(group.choice?.couponDiscount) && <div className={styles.checkoutDiscountRow}><span><UiText text={"Alennuskoodi "} />{group.choice?.couponCode}</span><strong>−{money(group.choice!.couponDiscount)}</strong></div>}</section>)}</div>
                <div className={styles.checkoutPaymentInfo}><div><UserRound size={18} /><span><small><UiText text={"Ostaja"} /></small><strong>{customerName}</strong><p>{customerAddress}, {postalCode} {customerCity}, {countrySettings(customerCountry).name}</p></span></div><div><Truck size={18} /><span><small><UiText text={"Toimitukset"} /></small><strong>{sellerGroups.length}<UiText text={" yritykseltä"} /></strong><p>{sellerTotals.map((group) => `${group.company.name}: ${group.choice?.shippingMethod === "posti" ? sellerPickupPoints[group.companyId]?.name ?? "noutopiste puuttuu" : "nouto yritykseltä"}`).join(" · ")}</p></span></div></div>
                <div className={styles.checkoutSecurePayment}><ShieldCheck size={26} /><div><strong><UiText text={"Turvallinen Maskines-maksu"} /></strong><p><UiText text={"Maksutietosi välitetään salattuina maksupalvelulle. Maskines tai myyjä ei näe kortti- tai verkkopankkitunnuksiasi."} /></p></div><span><LockKeyhole size={14} /><UiText text={" SSL-suojattu"} /></span></div>
                <MarketplaceResponsibilityNotice />
                <div className={styles.maskinesPaymentShell}>
                  <div className={styles.maskinesPaymentHeader}><div className={styles.maskinesPaymentMark}><span><UiText text={"M"} /></span></div><div><strong><UiText text={"Maskines Pay"} /></strong><small><UiText text={"Yksi turvallinen maksu · "} />{money(productTotal - couponTotal + shippingPrice)}</small></div><span><ShieldCheck size={16} /><UiText text={" Suojattu"} /></span></div>
                  {!paymentClientSecret && <div className={styles.paymentMethodsLoading} role="status" aria-live="polite">
                    <span className={styles.paymentLoadingRing} />
                    <div>
                      <strong>{submitting ? "Haetaan käytettävissä olevat maksutavat…" : "Maksutapoja ei voitu näyttää"}</strong>
                      <p>{submitting ? "Kortit, mobiilimaksut ja muut käytössä olevat maksutavat avautuvat tähän." : "Avaa suojattu maksulomake uudelleen."}</p>
                    </div>
                    {!submitting && <button type="button" onClick={() => void checkout()}><UiText text={"Näytä maksutavat"} /></button>}
                  </div>}
                  {paymentClientSecret && <div className={styles.embeddedCheckoutWrap}><div ref={paymentMountRef} className={styles.embeddedCheckout} /></div>}
                </div>
              </div>
            </section>}
          </div>

          <aside className={`${styles.panel} ${styles.cartSummary}`}>
            <div className={styles.cartSummarySeller}><span><UiText text={"Myyjät"} /></span><strong>{sellerGroups.length}<UiText text={" vahvistettua yritystä"} /></strong><small><UiText text={"Jokaiselle yritykselle muodostuu oma alitilaus"} /></small></div>
            <h2><UiText text={"Tilauksen yhteenveto"} /></h2>
            <div className={styles.cartTotals}><p><span><UiText text={"Tuotteet ("} />{itemCount})</span><strong>{money(productTotal)}</strong></p>{couponTotal > 0 && <p className={styles.cartDiscountTotal}><span><UiText text={"Alennuskoodit"} /></span><strong>−{money(couponTotal)}</strong></p>}<p><span><UiText text={"Toimitukset ("} />{sellerGroups.length})</span><strong>{shippingPrice === 0 ? "Maksuton" : money(shippingPrice)}</strong></p>{sellerTotals.map((group) => <p className={styles.cartSellerTotal} key={group.companyId}><span>{group.company.name}</span><strong>{money(group.total)}</strong></p>)}</div>
            <div className={styles.cartGrandTotal}><span><UiText text={"Maksettavaa"} /></span><strong>{money(productTotal - couponTotal + shippingPrice)}</strong><small><UiText text={"Yksi maksu, yrityskohtaiset tilaukset"} /></small></div>
            {cartNotice && <p className={styles.warning}>{cartNotice}</p>}{error && <p className={styles.error}>{error}</p>}
            <div className={styles.checkoutStageActions}>
              {step > 1 && !paymentClientSecret && <button type="button" className={styles.checkoutBackButton} onClick={() => openStep((step - 1) as CheckoutStep)}><ArrowLeft size={17} /><UiText text={" Edellinen"} /></button>}
              {step < 4 && <button type="button" className={styles.checkoutNextButton} onClick={() => continueTo((step + 1) as CheckoutStep)}>{step === 1 ? "Jatka tietoihin" : step === 2 ? "Jatka toimitukseen" : "Jatka maksuun"}<ChevronRight size={18} /></button>}
              {step === 4 && !paymentClientSecret && submitting && <div className={styles.paymentReadyBadge}><LockKeyhole size={18} /><span><strong><UiText text={"Avataan maksutapoja…"} /></strong><small><UiText text={"Maksunäkymä latautuu automaattisesti."} /></small></span></div>}
              {step === 4 && !paymentClientSecret && !submitting && error && <button className={styles.checkoutButton} disabled={loading || lines.length !== cart.length} onClick={checkout}><LockKeyhole size={18} />{`Yritä uudelleen · ${money(productTotal - couponTotal + shippingPrice)}`}</button>}
              {step === 4 && paymentClientSecret && <div className={styles.paymentReadyBadge}><CircleCheck size={18} /><span><strong><UiText text={"Maksuvaihe avattu"} /></strong><small><UiText text={"Viimeistele maksu vasemmalla."} /></small></span></div>}
            </div>
            <div className={styles.cartSecurity}><span><Check size={15} /><UiText text={" Hinta ja varastosaldo tarkistetaan"} /></span><span><Check size={15} /><UiText text={" Kuitti lähetetään maksun jälkeen"} /></span><span><Check size={15} /><UiText text={" Turvallinen Stripe-maksu"} /></span></div>
            <button className={styles.clearCartButton} onClick={() => { clearCart(); setCart([]); }}><Trash2 size={14} /><UiText text={" Tyhjennä ostoskori"} /></button>
          </aside>
        </div>
      </div>
    </main>
  );
}
