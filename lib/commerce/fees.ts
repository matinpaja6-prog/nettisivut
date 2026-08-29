export const MASKINES_FEE_RATE = 0.01;

export type StripeFeeAllocationInput = {
  id: string;
  grossCents: number;
};

/**
 * Splits the payment's actual Stripe fee across seller orders without losing
 * or creating cents. The largest-remainder method keeps the allocations fair
 * while guaranteeing that their sum equals the fee charged by Stripe.
 */
export function allocateActualStripeFee(
  orders: StripeFeeAllocationInput[],
  stripeFeeCents: number,
) {
  const normalizedFee = Math.max(0, Math.trunc(stripeFeeCents));
  const normalizedOrders = orders.map((order) => ({
    id: order.id,
    grossCents: Math.max(0, Math.trunc(order.grossCents)),
  }));
  const totalGross = normalizedOrders.reduce((sum, order) => sum + order.grossCents, 0);
  if (!normalizedOrders.length || normalizedFee === 0) {
    return new Map(normalizedOrders.map((order) => [order.id, 0]));
  }
  if (totalGross <= 0) {
    throw new Error("Stripe-kulua ei voi kohdistaa nollan euron tilauksille.");
  }

  const shares = normalizedOrders.map((order) => {
    const exact = normalizedFee * order.grossCents / totalGross;
    const cents = Math.floor(exact);
    return { ...order, cents, remainder: exact - cents };
  });
  let unallocated = normalizedFee - shares.reduce((sum, share) => sum + share.cents, 0);
  shares.sort((a, b) => b.remainder - a.remainder || b.grossCents - a.grossCents || a.id.localeCompare(b.id));
  for (let index = 0; index < shares.length && unallocated > 0; index += 1, unallocated -= 1) {
    shares[index].cents += 1;
  }

  return new Map(shares.map((share) => [share.id, share.cents]));
}

export type FeePricingStrategy = "deduct" | "include";

export type FeeEstimateMethod =
  | "card_standard"
  | "mobilepay"
  | "klarna"
  | "revolut_pay"
  | "card_premium"
  | "card_international";

export type FeeMethodDefinition = {
  id: FeeEstimateMethod;
  label: string;
  shortLabel: string;
  percent: number;
  fixedCents: number;
  note: string;
};

// Estimates based on Stripe's public Finland pricing. Stripe determines the
// final fee from the actual payment method, card origin and connected account.
export const FEE_METHODS: readonly FeeMethodDefinition[] = [
  {
    id: "card_standard",
    label: "Kortti / Link (ETA-kuluttajakortti)",
    shortLabel: "Kortti / Link",
    percent: 0.015,
    fixedCents: 25,
    note: "1,5 % + 0,25 €"
  },
  {
    id: "mobilepay",
    label: "MobilePay",
    shortLabel: "MobilePay",
    percent: 0.015,
    fixedCents: 36,
    note: "1,5 % + 0,36 €"
  },
  {
    id: "klarna",
    label: "Klarna",
    shortLabel: "Klarna",
    percent: 0.0299,
    fixedCents: 40,
    note: "2,99 % + 0,40 €"
  },
  {
    id: "revolut_pay",
    label: "Revolut Pay",
    shortLabel: "Revolut Pay",
    percent: 0.015,
    fixedCents: 25,
    note: "1,5 % + 0,25 €"
  },
  {
    id: "card_premium",
    label: "Premium-kortti (ETA)",
    shortLabel: "Premium-kortti",
    percent: 0.028,
    fixedCents: 25,
    note: "2,8 % + 0,25 €"
  },
  {
    id: "card_international",
    label: "Kansainvälinen kortti",
    shortLabel: "Kansainvälinen kortti",
    percent: 0.0315,
    fixedCents: 25,
    note: "3,15 % + 0,25 €"
  }
] as const;

export function isFeeEstimateMethod(value: unknown): value is FeeEstimateMethod {
  return FEE_METHODS.some((method) => method.id === value);
}

export function feeMethod(method: FeeEstimateMethod | null | undefined) {
  return FEE_METHODS.find((candidate) => candidate.id === method) ?? FEE_METHODS[0];
}

export function estimateCommerceFees(grossCents: number, method: FeeEstimateMethod) {
  const gross = Math.max(0, Math.trunc(grossCents));
  const definition = feeMethod(method);
  const maskinesFeeCents = Math.round(gross * MASKINES_FEE_RATE);
  const stripeFeeCents = gross > 0
    ? Math.round(gross * definition.percent) + definition.fixedCents
    : 0;
  const totalFeeCents = maskinesFeeCents + stripeFeeCents;

  return {
    grossCents: gross,
    maskinesFeeCents,
    stripeFeeCents,
    totalFeeCents,
    sellerNetCents: Math.max(0, gross - totalFeeCents)
  };
}

export function grossUpCommercePrice(targetNetCents: number, method: FeeEstimateMethod) {
  const target = Math.max(0, Math.trunc(targetNetCents));
  if (target === 0) return 0;
  const definition = feeMethod(method);
  let gross = Math.ceil(
    (target + definition.fixedCents) /
    (1 - MASKINES_FEE_RATE - definition.percent)
  );

  while (estimateCommerceFees(gross, method).sellerNetCents < target) gross += 1;
  while (gross > 1 && estimateCommerceFees(gross - 1, method).sellerNetCents >= target) gross -= 1;
  return gross;
}

export function stripePaymentMethodLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    card: "Kortti",
    link: "Link",
    mobilepay: "MobilePay",
    klarna: "Klarna",
    revolut_pay: "Revolut Pay",
    pay_by_bank: "Pankkimaksu"
  };
  return value ? labels[value] ?? value.replaceAll("_", " ") : "Ei vielä tiedossa";
}
