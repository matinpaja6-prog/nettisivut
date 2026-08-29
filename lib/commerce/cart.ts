"use client";

export type StoredCartItem = { productId: string; companyId: string; quantity: number };

const CART_KEY = "maskines-commerce-cart-v1";

export function readCart(): StoredCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is StoredCartItem => Boolean(
      item && typeof item === "object" &&
      typeof (item as StoredCartItem).productId === "string" &&
      typeof (item as StoredCartItem).companyId === "string" &&
      Number.isInteger((item as StoredCartItem).quantity) &&
      (item as StoredCartItem).quantity > 0
    ));
  } catch {
    return [];
  }
}

export function saveCart(items: StoredCartItem[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("maskines-cart-changed", { detail: items }));
}

export function addCartProduct(productId: string, companyId: string, quantity = 1): { ok: true; items: StoredCartItem[]; error: string } {
  const cart = readCart();
  const existing = cart.find((item) => item.productId === productId);
  if (existing) existing.quantity += Math.max(1, Math.trunc(quantity));
  else cart.push({ productId, companyId, quantity: Math.max(1, Math.trunc(quantity)) });
  saveCart(cart);
  return { ok: true as const, items: cart, error: "" };
}

export function clearCart() {
  saveCart([]);
}
