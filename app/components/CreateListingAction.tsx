"use client";

import Link from "./LocalizedLink";
import { useLanguage } from "@/lib/i18n";

/** One action for both guest and signed-in headers; /sell retains its auth gate. */
export default function CreateListingAction() {
  const { t } = useLanguage();
  return <Link id="maskines-create-listing-button" href="/sell" className="universal-create-button universal-create-button-desktop-only">
    <span className="universal-create-plus" aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false"><path d="M8 3v10M3 8h10" /></svg>
    </span>
    <strong>{t.createListing}</strong>
  </Link>;
}
