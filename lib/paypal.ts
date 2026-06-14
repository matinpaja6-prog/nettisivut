import { getPointPackage } from "@/lib/point-packages";

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

function paypalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal-avaimet puuttuvat ympäristömuuttujista.");
  }

  return { clientId, secret };
}

export async function getPayPalAccessToken() {
  const { clientId, secret } = paypalCredentials();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    throw new Error(`PayPal access token epäonnistui: ${await response.text()}`);
  }

  const data = await response.json() as { access_token?: string };

  if (!data.access_token) {
    throw new Error("PayPal ei palauttanut access tokenia.");
  }

  return data.access_token;
}

export async function createPayPalPointOrder(packageId: string, userId: string) {
  const pointPackage = getPointPackage(packageId);

  if (!pointPackage) {
    throw new Error("Tuntematon pistepaketti.");
  }

  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: pointPackage.id,
          description: `${pointPackage.points} Maskines pistettä`,
          custom_id: `${userId}:${pointPackage.id}`,
          amount: {
            currency_code: pointPackage.currency,
            value: pointPackage.amount
          }
        }
      ],
      application_context: {
        brand_name: "Maskines",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`PayPal orderin luonti epäonnistui: ${await response.text()}`);
  }

  return await response.json() as { id: string; status: string };
}

export async function capturePayPalOrder(orderId: string) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`PayPal capture epäonnistui: ${await response.text()}`);
  }

  return await response.json() as {
    id: string;
    status: string;
    purchase_units?: Array<{
      reference_id?: string;
      custom_id?: string;
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          amount?: {
            currency_code?: string;
            value?: string;
          };
        }>;
      };
    }>;
  };
}
