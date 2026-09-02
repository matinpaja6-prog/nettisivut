"use client";

import { useRouter as useNextRouter, usePathname as useNextPathname } from "next/navigation";
import { useContext, useMemo } from "react";
import { LanguageContext } from "@/app/components/LanguageProvider";
import { localizeHref, stripLocalePrefix } from "./routes";

export function useRouter() {
  const router = useNextRouter();
  const { locale } = useContext(LanguageContext);
  return useMemo(() => ({
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localizeHref(href, locale), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(localizeHref(href, locale), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(localizeHref(href, locale), options)
  }), [router, locale]);
}

export function usePathname() {
  const pathname = useNextPathname();
  return pathname ? stripLocalePrefix(pathname) : pathname;
}
