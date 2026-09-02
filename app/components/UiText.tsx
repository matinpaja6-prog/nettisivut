"use client";

import { useLanguage } from "@/lib/i18n";
import { getStaticTranslation } from "@/lib/ui-translations";

// Returns text, not an extra element: existing CSS and accessible names stay intact.
// React owns the translated text on both the server and client.
export default function UiText({ text }: { text: string }) {
  const { locale } = useLanguage();
  if (locale === "fi") return text;
  const translated = getStaticTranslation(locale, text.trim());
  return translated ? text.replace(text.trim(), translated) : text;
}
