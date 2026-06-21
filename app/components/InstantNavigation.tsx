"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const prefetched = new Set<string>();

function getLocalHrefFromAnchor(link: HTMLAnchorElement) {
  if (!(link instanceof HTMLAnchorElement)) return null;
  if (link.target && link.target !== "_self") return null;
  if (link.hasAttribute("download")) return null;
  if (link.dataset.instantNavigation === "false") return null;

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

function getLocalHref(target: EventTarget | null) {
  const link = target instanceof Element
    ? target.closest("a[href]")
    : null;

  if (!(link instanceof HTMLAnchorElement)) return null;
  return getLocalHrefFromAnchor(link);
}

export default function InstantNavigation() {
  const router = useRouter();

  useEffect(() => {
    const prefetchHref = (href: string | null) => {
      if (!href || prefetched.has(href)) return;

      prefetched.add(href);
      router.prefetch(href);
    };

    const prefetch = (target: EventTarget | null) => {
      prefetchHref(getLocalHref(target));
    };

    const prefetchVisibleLinks = () => {
      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
        const rect = link.getBoundingClientRect();
        if (
          rect.bottom < 0 ||
          rect.right < 0 ||
          rect.top > window.innerHeight ||
          rect.left > window.innerWidth
        ) {
          return;
        }

        prefetchHref(getLocalHrefFromAnchor(link));
      });
    };

    const scheduleVisiblePrefetch = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(prefetchVisibleLinks, { timeout: 1200 });
        return;
      }

      setTimeout(prefetchVisibleLinks, 120);
    };

    const handlePointerEnter = (event: PointerEvent) => prefetch(event.target);
    const handlePointerDown = (event: PointerEvent) => prefetch(event.target);
    const handleFocusIn = (event: FocusEvent) => prefetch(event.target);
    const handleScroll = () => scheduleVisiblePrefetch();

    const observer = new MutationObserver(scheduleVisiblePrefetch);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("pointerover", handlePointerEnter, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    window.addEventListener("scroll", handleScroll, { passive: true });
    scheduleVisiblePrefetch();

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerover", handlePointerEnter, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [router]);

  return null;
}
