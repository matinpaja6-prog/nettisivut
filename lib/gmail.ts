import "server-only";

import { createSign } from "node:crypto";

type GmailCredentials = {
  client_email: string;
  private_key: string;
};

type GmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

type CachedAccessToken = {
  value: string;
  expiresAt: number;
};

let cachedAccessToken: CachedAccessToken | null = null;

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function cleanHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodedHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(cleanHeader(value), "utf8").toString("base64")}?=`;
}

function credentialsFromEnvironment(): GmailCredentials {
  const encodedJson = process.env.GMAIL_SERVICE_ACCOUNT_JSON_BASE64?.trim();

  if (encodedJson) {
    const parsed = JSON.parse(
      Buffer.from(encodedJson, "base64").toString("utf8")
    ) as Partial<GmailCredentials>;

    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key
      };
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")
    .trim();

  if (!clientEmail || !privateKey) {
    throw new Error("Gmail-palvelutilin tunnukset puuttuvat palvelimelta.");
  }

  return {
    client_email: clientEmail,
    private_key: privateKey
  };
}

async function gmailAccessToken() {
  if (
    cachedAccessToken &&
    cachedAccessToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedAccessToken.value;
  }

  const credentials = credentialsFromEnvironment();
  const sender = process.env.GMAIL_SENDER_EMAIL?.trim() || "info@maskines.com";
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      sub: sender,
      scope: "https://www.googleapis.com/auth/gmail.send",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );
  const unsignedToken = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(credentials.private_key).toString("base64url");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }),
    cache: "no-store"
  });
  const body = await response.json() as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_description ||
      body.error ||
      "Gmail-käyttöoikeuden hakeminen epäonnistui."
    );
  }

  cachedAccessToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000
  };

  return body.access_token;
}

function buildMimeMessage(input: GmailMessage) {
  const boundary = `maskines_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const sender = process.env.GMAIL_SENDER_EMAIL?.trim() || "info@maskines.com";
  const headers = [
    `From: Maskines <${cleanHeader(sender)}>`,
    `To: ${cleanHeader(input.to)}`,
    `Subject: ${encodedHeader(input.subject)}`,
    ...(input.replyTo ? [`Reply-To: ${cleanHeader(input.replyTo)}`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.text, "utf8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.html, "utf8").toString("base64"),
    `--${boundary}--`,
    ""
  ];

  return [...headers, "", ...parts].join("\r\n");
}

export async function sendGmailMessage(input: GmailMessage) {
  const sender = process.env.GMAIL_SENDER_EMAIL?.trim() || "info@maskines.com";
  const accessToken = await gmailAccessToken();
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(sender)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        raw: base64Url(buildMimeMessage(input))
      }),
      cache: "no-store"
    }
  );
  const body = await response.json() as {
    id?: string;
    error?: {
      message?: string;
    };
  };

  if (!response.ok || !body.id) {
    throw new Error(
      body.error?.message || "Gmail-sähköpostin lähettäminen epäonnistui."
    );
  }

  return {
    id: body.id
  };
}
