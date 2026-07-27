import "server-only";

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

type VerificationResult =
  | { success: true }
  | { success: false; error: string };

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

function allowedHostnames(request: Request) {
  const hostnames = new Set(["maskines.com", "www.maskines.com"]);

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  const requestHostname = requestHost.split(":")[0]?.toLowerCase();
  if (requestHostname === "localhost" || requestHostname === "127.0.0.1") {
    hostnames.add(requestHostname);
  }

  try {
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      hostnames.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname);
    }
  } catch {
    // A malformed optional site URL must not disable Turnstile validation.
  }

  return hostnames;
}

export async function verifyTurnstile(
  request: Request,
  token: unknown,
  expectedAction: string
): Promise<VerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: false, error: "Bottitarkistuksen salainen avain puuttuu palvelimelta." };
  }

  if (typeof token !== "string" || token.length < 10 || token.length > 2048) {
    return { success: false, error: "Tee bottitarkistus uudelleen." };
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const remoteIp = getClientIp(request);
  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000)
      }
    );
    const result = (await response.json()) as TurnstileResponse;

    if (!response.ok || !result.success) {
      return { success: false, error: "Bottitarkistus epäonnistui. Yritä uudelleen." };
    }
    if (result.action !== expectedAction) {
      return { success: false, error: "Bottitarkistus ei vastannut tätä toimintoa." };
    }
    if (!result.hostname || !allowedHostnames(request).has(result.hostname.toLowerCase())) {
      return { success: false, error: "Bottitarkistus tuli väärältä sivustolta." };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Bottitarkistusta ei voitu varmistaa. Yritä uudelleen." };
  }
}
