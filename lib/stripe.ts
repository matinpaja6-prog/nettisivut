import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe-palvelimen salainen avain puuttuu ympäristömuuttujista.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      appInfo: {
        name: "Maskines Commerce",
        version: "1.0.0"
      }
    });
  }

  return stripeClient;
}
