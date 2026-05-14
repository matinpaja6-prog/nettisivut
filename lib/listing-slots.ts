export type ListingSlotPlan = {
  id: "plus100" | "plus250";
  title: string;
  slots: number;
  cost: number;
  days: number;
  description: string;
};

export type ListingSlotPurchase = {
  id: string;
  planId: ListingSlotPlan["id"];
  slots: number;
  cost: number;
  createdAt: string;
  expiresAt: string;
};

export const BASE_LISTING_SLOT_LIMIT = 100;

export const LISTING_SLOT_PLANS: ListingSlotPlan[] = [
  {
    id: "plus100",
    title: "+100 ilmoituspaikkaa",
    slots: 100,
    cost: 500,
    days: 30,
    description: "Nosta aktiivisten ilmoitusten raja 200 paikkaan kuukaudeksi."
  },
  {
    id: "plus250",
    title: "+250 ilmoituspaikkaa",
    slots: 250,
    cost: 1000,
    days: 30,
    description: "Nosta aktiivisten ilmoitusten raja 350 paikkaan kuukaudeksi."
  }
];

const STORAGE_PREFIX = "arctic_listing_slot_purchases_";
export const LISTING_SLOT_STORAGE_EVENT = "arctic-listing-slots-updated";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function isActivePurchase(purchase: ListingSlotPurchase, now = Date.now()) {
  return new Date(purchase.expiresAt).getTime() > now;
}

export function readListingSlotPurchases(userId: string): ListingSlotPurchase[] {
  if (typeof window === "undefined" || !userId) return [];

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    const active = parsed.filter((item): item is ListingSlotPurchase => {
      return Boolean(
        item &&
          typeof item.id === "string" &&
          typeof item.planId === "string" &&
          typeof item.slots === "number" &&
          typeof item.cost === "number" &&
          typeof item.createdAt === "string" &&
          typeof item.expiresAt === "string" &&
          isActivePurchase(item)
      );
    });

    if (active.length !== parsed.length) {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(active));
    }

    return active;
  } catch {
    return [];
  }
}

export function getListingSlotBonus(purchases: ListingSlotPurchase[]) {
  return purchases.reduce((total, purchase) => total + purchase.slots, 0);
}

export function getListingSlotLimit(
  userId?: string | null,
  purchases?: ListingSlotPurchase[],
  dbExtraSlots?: number
) {
  const activePurchases = purchases ?? (userId ? readListingSlotPurchases(userId) : []);
  return BASE_LISTING_SLOT_LIMIT + getListingSlotBonus(activePurchases) + (dbExtraSlots ?? 0);
}

export function addListingSlotPurchase(
  userId: string,
  plan: ListingSlotPlan
): ListingSlotPurchase[] {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + plan.days * 24 * 60 * 60 * 1000);
  const purchase: ListingSlotPurchase = {
    id: `${plan.id}-${createdAt.getTime()}`,
    planId: plan.id,
    slots: plan.slots,
    cost: plan.cost,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  const next = [...readListingSlotPurchases(userId), purchase];

  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    window.dispatchEvent(new Event(LISTING_SLOT_STORAGE_EVENT));
  }

  return next;
}
