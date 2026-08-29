import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type UnsubscribePayload = {
  userId: string;
  email: string;
};

function signingSecret() {
  const secret = process.env.EMAIL_LIFECYCLE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("EMAIL_LIFECYCLE_SECRET puuttuu.");
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createUnsubscribeToken(input: UnsubscribePayload) {
  const payload = Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  const [payload, receivedSignature] = token.split(".");
  if (!payload || !receivedSignature) return null;

  const expectedSignature = signature(payload);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<UnsubscribePayload>;
    if (!parsed.userId || !parsed.email) return null;
    return { userId: parsed.userId, email: parsed.email.toLowerCase() };
  } catch {
    return null;
  }
}
