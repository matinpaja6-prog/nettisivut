"use client";

import { PackageOpen, ShoppingCart, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { readCart, saveCart, type StoredCartItem } from "@/lib/commerce/cart";
import { activeSalePrice } from "@/lib/commerce/discounts";
import type { PublicProduct } from "@/lib/commerce/types";
import { useLanguage, type Locale } from "@/lib/i18n";
import { useCurrency } from "./CurrencyProvider";

type CartHoverPreviewProps = {
  quantity: number;
};

const cartText: Record<Locale, { cart: string; preview: string; empty: string; emptyHelp: string; loading: string; remove: string; total: string; open: string; items: (count: number) => string }> = {
  fi: { cart: "Ostoskori", preview: "Ostoskorin esikatselu", empty: "Ostoskorisi on tyhjä", emptyHelp: "Lisää yrityksen tuotteita ostoskoriin.", loading: "Ladataan ostoskoria…", remove: "Poista korista", total: "Yhteensä", open: "Siirry ostoskoriin", items: (count) => count ? `${count} tuotetta` : "Tyhjä" },
  en: { cart: "Cart", preview: "Cart preview", empty: "Your cart is empty", emptyHelp: "Add products from company stores to your cart.", loading: "Loading cart…", remove: "Remove from cart", total: "Total", open: "Go to cart", items: (count) => count ? `${count} ${count === 1 ? "item" : "items"}` : "Empty" },
  sv: { cart: "Varukorg", preview: "Förhandsvisning av varukorgen", empty: "Din varukorg är tom", emptyHelp: "Lägg till produkter från företagsbutiker i varukorgen.", loading: "Läser in varukorgen…", remove: "Ta bort ur varukorgen", total: "Totalt", open: "Gå till varukorgen", items: (count) => count ? `${count} ${count === 1 ? "produkt" : "produkter"}` : "Tom" },
  no: { cart: "Handlekurv", preview: "Forhåndsvisning av handlekurven", empty: "Handlekurven din er tom", emptyHelp: "Legg til produkter fra bedriftsbutikker i handlekurven.", loading: "Laster handlekurven…", remove: "Fjern fra handlekurven", total: "Totalt", open: "Gå til handlekurven", items: (count) => count ? `${count} ${count === 1 ? "vare" : "varer"}` : "Tom" },
};

export default function CartHoverPreview({ quantity }: CartHoverPreviewProps) {
  const pathname = usePathname();
  const { locale } = useLanguage();
  const text = cartText[locale];
  const { formatFromEur } = useCurrency();
  const [cart, setCart] = useState<StoredCartItem[]>([]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ top: 0, right: 12 });
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDisabled = pathname === "/ostoskori";

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function updatePreviewPosition() {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPreviewPosition({
      top: rect.bottom + 10,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }

  function showPreview() {
    if (previewDisabled) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    updatePreviewPosition();
    setOpen(true);
  }

  useEffect(() => {
    if (previewDisabled) setOpen(false);
  }, [previewDisabled]);

  function hidePreviewSoon() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpen(false), 180);
  }

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const reposition = () => updatePreviewPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    const syncCart = () => setCart(readCart());
    syncCart();
    window.addEventListener("maskines-cart-changed", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("maskines-cart-changed", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    if (!cart.length) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all(cart.map(async (item) => {
      const response = await fetch(`/api/commerce/catalog/${encodeURIComponent(item.productId)}`, { cache: "no-store" });
      if (response.status === 404) return { item, product: null };
      const body = await response.json().catch(() => ({})) as { product?: PublicProduct };
      if (!response.ok) throw new Error("Ostoskorin esikatselua ei voitu ladata.");
      return { item, product: body.product ?? null };
    })).then((results) => {
      if (cancelled) return;
      const validResults = results.filter(
        (result): result is { item: StoredCartItem; product: PublicProduct } => Boolean(result.product),
      );
      const validCart = validResults.map(({ item, product }) => ({
        ...item,
        quantity: Math.max(1, Math.min(item.quantity, product.stock_quantity)),
      }));
      setProducts(validResults.map(({ product }) => product));
      if (JSON.stringify(validCart) !== JSON.stringify(cart)) saveCart(validCart);
    }).catch(() => {
      if (!cancelled) setProducts([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [cart]);

  const lines = useMemo(() => cart
    .map((item) => ({ item, product: products.find((product) => product.id === item.productId) }))
    .filter((line): line is { item: StoredCartItem; product: PublicProduct } => Boolean(line.product)), [cart, products]);
  const subtotal = lines.reduce((sum, { item, product }) => sum + activeSalePrice(product) * item.quantity, 0);
  const money = (cents: number) => formatFromEur(cents / 100);

  function removeProduct(productId: string) {
    const nextCart = cart.filter((item) => item.productId !== productId);
    setCart(nextCart);
    saveCart(nextCart);
  }

  const preview = mounted && open ? createPortal(
      <section
        className="universal-cart-preview is-open"
        aria-label={text.preview}
        onMouseEnter={showPreview}
        onMouseLeave={hidePreviewSoon}
        style={{
          position: "fixed",
          top: previewPosition.top,
          right: previewPosition.right,
          zIndex: 2147483647,
        }}
      >
        <div className="universal-cart-preview-title">
          <strong>{text.cart}</strong>
          <span>{text.items(quantity)}</span>
        </div>

        {loading && cart.length ? <div className="universal-cart-preview-loading">{text.loading}</div> : null}

        {!loading && !lines.length ? (
          <div className="universal-cart-preview-empty">
            <PackageOpen size={27} aria-hidden="true" />
            <strong>{text.empty}</strong>
            <span>{text.emptyHelp}</span>
          </div>
        ) : null}

        {lines.length ? (
          <>
            <div className="universal-cart-preview-lines">
              {lines.map(({ item, product }) => {
                const currentPrice = activeSalePrice(product);
                const onSale = currentPrice < product.price_cents;
                return (
                  <article className="universal-cart-preview-line" key={product.id}>
                    <Link href={`/tuotteet/${product.id}`} className="universal-cart-preview-image" tabIndex={-1}>
                      {product.image_urls?.[0]
                        ? <Image src={product.image_urls[0]} width={72} height={62} alt="" unoptimized />
                        : <PackageOpen size={25} aria-hidden="true" />}
                    </Link>
                    <div className="universal-cart-preview-info">
                      <Link href={`/tuotteet/${product.id}`}>{product.name}</Link>
                      <button type="button" onClick={() => removeProduct(product.id)}>
                        <Trash2 size={13} aria-hidden="true" /> {text.remove}
                      </button>
                    </div>
                    <div className="universal-cart-preview-price">
                      <span>{item.quantity}×</span>
                      <strong>{money(currentPrice * item.quantity)}</strong>
                      {onSale ? <del>{money(product.price_cents * item.quantity)}</del> : null}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="universal-cart-preview-total">
              <span>{text.total}</span>
              <strong>{money(subtotal)}</strong>
            </div>
          </>
        ) : null}

        <Link className="universal-cart-preview-button" href="/ostoskori">
          {text.open}
        </Link>
      </section>,
    document.body,
  ) : null;

  return (
    <div
      className="universal-cart-hover"
      onMouseEnter={showPreview}
      onMouseLeave={hidePreviewSoon}
      onFocus={showPreview}
      onBlur={hidePreviewSoon}
    >
      <Link
        ref={triggerRef}
        href="/ostoskori"
        className="universal-icon-button universal-notification-button universal-cart-trigger"
        aria-label={`${text.cart}${quantity ? `, ${text.items(quantity)}` : ""}`}
        aria-haspopup={previewDisabled ? undefined : "dialog"}
        aria-expanded={previewDisabled ? undefined : open}
      >
        <ShoppingCart size={17} aria-hidden="true" />
        {quantity > 0 ? <span className="universal-notification-badge">{quantity > 9 ? "9+" : quantity}</span> : null}
      </Link>

      {preview}
    </div>
  );
}
