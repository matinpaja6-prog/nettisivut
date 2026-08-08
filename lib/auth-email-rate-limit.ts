import "server-only";

import { createHash } from "node:crypto";

const AUTH_EMAIL_COOLDOWN_MS = 60_000;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

type CooldownStore = {
  entries: Map<string, number>;
  lastCleanupAt: number;
};

type GlobalWithCooldownStore = typeof globalThis & {
  __maskinesAuthEmailCooldownStore?: CooldownStore;
};

export type AuthEmailCooldownLease = {
  key: string;
  expiresAt: number;
};

export type AuthEmailCooldownResult =
  | { allowed: true; lease: AuthEmailCooldownLease }
  | { allowed: false; retryAfterSeconds: number };

const globalStore = globalThis as GlobalWithCooldownStore;
const store = globalStore.__maskinesAuthEmailCooldownStore ?? {
  entries: new Map<string, number>(),
  lastCleanupAt: Date.now()
};
globalStore.__maskinesAuthEmailCooldownStore = store;

function recipientKey(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function cleanupExpiredEntries(now: number) {
  if (now - store.lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  for (const [key, expiresAt] of store.entries) {
    if (expiresAt <= now) store.entries.delete(key);
  }
  store.lastCleanupAt = now;
}

export function claimAuthEmailCooldown(email: string): AuthEmailCooldownResult {
  const now = Date.now();
  cleanupExpiredEntries(now);
  const key = recipientKey(email);
  const currentExpiry = store.entries.get(key) ?? 0;

  if (currentExpiry > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((currentExpiry - now) / 1000))
    };
  }

  const expiresAt = now + AUTH_EMAIL_COOLDOWN_MS;
  store.entries.set(key, expiresAt);
  return { allowed: true, lease: { key, expiresAt } };
}

export function releaseAuthEmailCooldown(lease: AuthEmailCooldownLease | undefined) {
  if (lease && store.entries.get(lease.key) === lease.expiresAt) {
    store.entries.delete(lease.key);
  }
}
