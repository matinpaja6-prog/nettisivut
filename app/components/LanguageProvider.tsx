"use client";

import { createContext, useCallback, useMemo, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { localeFromPath, translateLocalizedPath, type RouteLocale } from "@/lib/routes";

export const LanguageContext = createContext<{ locale: RouteLocale; setLocale: (locale: RouteLocale) => void }>({
  locale: "fi", setLocale: () => undefined
});

export default function LanguageProvider({ initialLocale, children }: { initialLocale: RouteLocale; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [locale, setCurrentLocale] = useState(initialLocale);

  useEffect(() => {
    const next = localeFromPath(pathname || "/");
    setCurrentLocale(next);
    document.documentElement.lang = next === "no" ? "nb" : next;
    document.documentElement.setAttribute("data-i18n-target", next);
    document.documentElement.removeAttribute("data-i18n-pending");
    try { localStorage.setItem("locale", next); } catch { /* Storage is optional. */ }
    document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(new CustomEvent("localechange", { detail: next }));
  }, [pathname]);

  const setLocale = useCallback((next: RouteLocale) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("lang");
    const language = next === "no" ? "nb" : next;
    const alternate = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="' + language + '"],link[rel="alternate"][hreflang="' + language + '-FI"]');
    const alternateHref = alternate?.getAttribute("href");
    // Collection pages can translate their deeper taxonomy segments too.
    url.pathname = alternateHref ? new URL(alternateHref, url.origin).pathname : translateLocalizedPath(url.pathname, next);
    setCurrentLocale(next);
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [router]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
