"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { canonicalPathFromLocalized } from "@/lib/routes";
import { MESSAGES_MOBILE_BACK_EVENT } from "@/lib/messages-navigation";

export default function MobileCornerNav() {
  const pathname = usePathname();
  const router = useRouter();
  const canonicalPathname = canonicalPathFromLocalized(pathname || "/");
  const isHomePage = canonicalPathname === "/";

  function goBack() {
    const openMessagesSubview =
      canonicalPathname === "/messages" &&
      typeof document !== "undefined" &&
      document.querySelector(
        ".messages-inbox-page.mobile-conversation-open, " +
        ".messages-inbox-page.seller-listing-open"
      );

    if (openMessagesSubview) {
      window.dispatchEvent(
        new Event(MESSAGES_MOBILE_BACK_EVENT)
      );
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  if (isHomePage) return null;

  return (
    <button
      type="button"
      className="mobile-corner-nav mobile-corner-back"
      aria-label="Takaisin edelliselle sivulle"
      onClick={goBack}
    >
      <ChevronLeft size={28} aria-hidden="true" />
    </button>
  );
}
