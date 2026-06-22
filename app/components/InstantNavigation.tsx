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
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash === window.location.hash
  ) return null;

  return `${url.pathname}${url.search}${url.hash}`;
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
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const href = getLocalHref(event.target);
      if (!href) return;

      event.preventDefault();
      router.push(href);
    };

    document.addEventListener("pointerover", handlePointerEnter, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("click", handleClick);
    scheduleVisiblePrefetch();

    return () => {
      document.removeEventListener("pointerover", handlePointerEnter, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("click", handleClick);
    };
  }, [router]);

  return null;
}
