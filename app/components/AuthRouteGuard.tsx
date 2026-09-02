"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/lib/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n";
import { canonicalPathFromLocalized, pagePath } from "@/lib/routes";

const protectedExactPaths = new Set([
  "/garage",
  "/my-listings",
  "/saved",
  "/followed",
  "/search-alerts",
  "/profile",
  "/tilaukset"
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
      const { data } = supabase
        ? await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
        : { data: { session: null } };
      const session = data.session;
      if (cancelled) return;

      // MFA is completed as part of the explicit /auth login flow. Protected
      // pages only check that a session exists, so opening Oma profiili never
      // launches a new MFA challenge in the middle of an existing session.
      if (session) return;

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
