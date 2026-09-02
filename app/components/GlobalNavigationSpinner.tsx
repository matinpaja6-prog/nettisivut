"use client";

import Image from "next/image";
import { usePathname } from "@/lib/navigation";
import { useEffect, useRef, useState } from "react";
import { NAVIGATION_START_EVENT } from "@/lib/go-back";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export default function GlobalNavigationSpinner() {
  const pathname = usePathname() || "";
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimer.current !== null) window.clearTimeout(showTimer.current);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      showTimer.current = null;
      hideTimer.current = null;
    };

    clearTimers();
    setVisible(false);

    return clearTimers;
  }, [pathname]);

  useEffect(() => {
    const start = () => {
      if (showTimer.current !== null) window.clearTimeout(showTimer.current);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);

      showTimer.current = window.setTimeout(() => {
        setVisible(true);
      }, 0);

      hideTimer.current = window.setTimeout(() => {
        setVisible(false);
      }, 4500);
    };

    const handleClick = (event: MouseEvent) => {
      if (isModifiedClick(event) || event.defaultPrevented) return;

      const target = event.target instanceof Element
        ? event.target.closest("a[href]")
        : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target && target.target !== "_self") return;
      if (target.hasAttribute("download")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(target.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;
      // Staying on the same route does not change `pathname`, so showing the
      // overlay here would leave it visible until the safety timer expires.
      if (nextUrl.pathname === window.location.pathname) {
        return;
      }

      start();
    };

    const handlePageShow = () => {
      setVisible(false);
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener(NAVIGATION_START_EVENT, start);
    window.addEventListener("popstate", start);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener(NAVIGATION_START_EVENT, start);
      window.removeEventListener("popstate", start);
      window.removeEventListener("pageshow", handlePageShow);
      if (showTimer.current !== null) window.clearTimeout(showTimer.current);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="global-navigation-spinner" role="status" aria-live="polite" aria-label="Siirrytään">
      <span className="global-navigation-brand" aria-hidden="true">
        <Image className="maskines-loading-logo maskines-loading-logo-light" src="/maskines-brand-mark-clean-v4.png" alt="" width={180} height={141} priority unoptimized />
        <Image className="maskines-loading-logo maskines-loading-logo-dark" src="/maskines-brand-mark-dark-clean-v4.png" alt="" width={180} height={141} priority unoptimized />
      </span>
    </div>
  );
}
