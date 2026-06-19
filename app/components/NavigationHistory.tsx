"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { rememberInternalPageVisit } from "@/lib/go-back";

export default function NavigationHistory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    rememberInternalPageVisit(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  return null;
}
