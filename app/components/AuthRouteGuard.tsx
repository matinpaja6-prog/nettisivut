"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSafeAuthUser, supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n";
import { canonicalPathFromLocalized, pagePath } from "@/lib/routes";

const protectedExactPaths = new Set([
  "/garage",
  "/my-listings",
  "/saved",
  "/followed",
  "/rewards",
  "/shop",
  "/search-alerts",
  "/profile"
]);

const protectedPrefixes = [
  "/sell",
  "/messages"
];

function isProtectedPath(pathname: string) {
  const canonical = canonicalPathFromLocalized(pathname || "/");
  if (protectedExactPaths.has(canonical)) return true;
  return protectedPrefixes.some((prefix) => canonical === prefix || canonical.startsWith(`${prefix}/`));
}

export default function AuthRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLanguage();

  useEffect(() => {
    if (!pathname || !isProtectedPath(pathname)) return;

    let cancelled = false;

    async function checkAccess() {
      const user = supabase ? await getSafeAuthUser().catch(() => null) : null;
      if (cancelled || user) return;

      const next = `${pathname}${window.location.search}${window.location.hash}`;
      router.replace(`${pagePath("auth", locale)}?mode=login&next=${encodeURIComponent(next)}`);
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [locale, pathname, router]);

  return null;
}
