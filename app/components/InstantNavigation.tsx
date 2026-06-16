"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const prefetched = new Set<string>();

function getLocalHref(target: EventTarget | null) {
  const link = target instanceof Element
    ? target.closest("a[href]")
    : null;

  if (!(link instanceof HTMLAnchorElement)) return null;
  if (link.target && link.target !== "_self") return null;
  if (link.hasAttribute("download")) return null;

  let url: URL;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;

  return `${url.pathname}${url.search}`;
}

export default function InstantNavigation() {
  const router = useRouter();

  useEffect(() => {
    const prefetch = (target: EventTarget | null) => {
      const href = getLocalHref(target);
      if (!href || prefetched.has(href)) return;

      prefetched.add(href);
      router.prefetch(href);
    };

    const handlePointerEnter = (event: PointerEvent) => prefetch(event.target);
    const handlePointerDown = (event: PointerEvent) => prefetch(event.target);
    const handleFocusIn = (event: FocusEvent) => prefetch(event.target);

    document.addEventListener("pointerover", handlePointerEnter, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      document.removeEventListener("pointerover", handlePointerEnter, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [router]);

  return null;
}
