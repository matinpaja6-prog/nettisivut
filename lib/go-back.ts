"use client";

import { canonicalPathFromLocalized } from "@/lib/routes";

type RouterLike = {
  back: () => void;
  push: (href: string) => void;
};

export const INTERNAL_HISTORY_STACK_KEY = "maskines:internal-history-stack:v1";
export const INTERNAL_HISTORY_BACK_PENDING_KEY = "maskines:internal-history-back-pending:v1";

const MAX_INTERNAL_HISTORY_ITEMS = 30;

function normalizeHref(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function readInternalHistoryStack() {
  try {
    const raw = sessionStorage.getItem(INTERNAL_HISTORY_STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeInternalHistoryStack(stack: string[]) {
  try {
    sessionStorage.setItem(
      INTERNAL_HISTORY_STACK_KEY,
      JSON.stringify(stack.slice(-MAX_INTERNAL_HISTORY_ITEMS))
    );
  } catch {
    /* Session storage can be unavailable in private/browser-restricted contexts. */
  }
}

function pathnameFromHref(href: string) {
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return href.split(/[?#]/)[0] || "/";
  }
}

function isListingDetailHref(href: string) {
  const pathname = canonicalPathFromLocalized(pathnameFromHref(href));
  return /^\/listing\/[^/?#]+/.test(pathname);
}

function isMessagesRedirectHref(href: string) {
  const pathname = canonicalPathFromLocalized(pathnameFromHref(href));
  return /^\/messages\/[^/?#]+/.test(pathname);
}

function isMessagesConversationHref(href: string) {
  const pathname = canonicalPathFromLocalized(pathnameFromHref(href));
  if (pathname !== "/messages") return false;

  try {
    const url = new URL(href, window.location.origin);
    return Boolean(url.searchParams.get("conversation"));
  } catch {
    return href.includes("conversation=");
  }
}

export function rememberInternalPageVisit(href: string) {
  if (typeof window === "undefined") return;

  const normalizedHref = normalizeHref(href);
  if (
    !normalizedHref ||
    isMessagesRedirectHref(normalizedHref) ||
    isMessagesConversationHref(normalizedHref)
  ) {
    return;
  }

  const stack = readInternalHistoryStack();
  let backPending = false;

  try {
    backPending = sessionStorage.getItem(INTERNAL_HISTORY_BACK_PENDING_KEY) === "1";
    if (backPending) {
      sessionStorage.removeItem(INTERNAL_HISTORY_BACK_PENDING_KEY);
    }
  } catch {
    backPending = false;
  }

  if (backPending) {
    if (stack.at(-1) !== normalizedHref) {
      stack.push(normalizedHref);
    }

    writeInternalHistoryStack(stack);
    return;
  }

  if (stack.at(-1) === normalizedHref) return;

  stack.push(normalizedHref);
  writeInternalHistoryStack(stack);
}

export function goBackOrFallback(
  router: RouterLike,
  fallback = "/"
) {
  if (typeof window === "undefined") {
    router.push(fallback);
    return;
  }

  const currentHref = normalizeHref(window.location.href);
  if (currentHref && isMessagesConversationHref(currentHref)) {
    router.push("/messages");
    return;
  }

  const stack = readInternalHistoryStack();
  const skipListingDetails = currentHref ? isListingDetailHref(currentHref) : false;

  while (
    stack.length > 0 &&
    (
      stack.at(-1) === currentHref ||
      (skipListingDetails && isListingDetailHref(stack.at(-1) ?? "")) ||
      isMessagesRedirectHref(stack.at(-1) ?? "") ||
      isMessagesConversationHref(stack.at(-1) ?? "")
    )
  ) {
    stack.pop();
  }

  const previousHref = stack.at(-1);
  if (previousHref) {
    writeInternalHistoryStack(stack);
    try {
      sessionStorage.setItem(INTERNAL_HISTORY_BACK_PENDING_KEY, "1");
    } catch {
      /* ok */
    }
    router.push(previousHref);
    return;
  }

  const referrerHref = document.referrer ? normalizeHref(document.referrer) : null;
  if (referrerHref && referrerHref !== currentHref) {
    router.push(referrerHref);
    return;
  }

  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push(fallback);
}
