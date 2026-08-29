import "server-only";

import type { Metadata } from "next";

import { resolvePublicProfile } from "@/lib/public-profile-route";
import { profilePath, type RouteLocale } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";

export async function storefrontMetadata(
  identifier: string,
  locale: RouteLocale = "fi"
): Promise<Metadata> {
  const profile = await resolvePublicProfile(identifier);
  if (!profile) return { robots: { index: false, follow: true } };
  const title = profile.accountType === "company"
    ? `${profile.name} varaosakauppa | Maskines`
    : `${profile.name} myyjäprofiili | Maskines`;
  const description = profile.description || (profile.accountType === "company"
    ? `Tutustu yrityksen ${profile.name} varaosiin ja myynti-ilmoituksiin Maskinesissa.`
    : `Katso myyjän ${profile.name} myynti-ilmoitukset Maskinesissa.`);
  const canonical = absoluteSiteUrl(profilePath(profile.id, profile.name, locale));
  const languages = {
    "fi-FI": absoluteSiteUrl(profilePath(profile.id, profile.name, "fi")),
    en: absoluteSiteUrl(profilePath(profile.id, profile.name, "en")),
    sv: absoluteSiteUrl(profilePath(profile.id, profile.name, "sv")),
    nb: absoluteSiteUrl(profilePath(profile.id, profile.name, "no")),
    "x-default": absoluteSiteUrl(profilePath(profile.id, profile.name, "fi"))
  };
  return {
    title: { absolute: title },
    description,
    robots: { index: true, follow: true },
    alternates: { canonical, languages },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Maskines",
      url: canonical,
      ...(profile.image ? { images: [{ url: profile.image, alt: profile.name }] } : {})
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(profile.image ? { images: [profile.image] } : {})
    }
  };
}
