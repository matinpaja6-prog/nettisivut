import { notFound, permanentRedirect } from "next/navigation";


import SellerProfileClient from "@/app/seller/[id]/seller-profile-client";
import { resolvePublicProfile } from "@/lib/public-profile-route";
import { profilePath, type RouteLocale } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";

function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function PublicProfileRoutePage({
  identifier,
  locale
}: {
  identifier: string;
  locale: RouteLocale;
}) {
  const profile = await resolvePublicProfile(identifier);
  if (!profile) notFound();

  const canonicalPath = profilePath(profile.id, profile.name, locale);
  if (decodeURIComponent(identifier) !== profile.slug) {
    permanentRedirect(canonicalPath);
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": profile.accountType === "company" ? "Organization" : "Person",
    name: profile.name,
    url: absoluteSiteUrl(canonicalPath),
    ...(profile.description ? { description: profile.description } : {}),
    ...(profile.image ? { image: profile.image } : {}),
    ...(profile.website ? { sameAs: [profile.website] } : {}),
    ...((profile.city || profile.country) ? {
      address: {
        "@type": "PostalAddress",
        ...(profile.city ? { addressLocality: profile.city } : {}),
        ...(profile.country ? { addressCountry: profile.country } : {})
      }
    } : {})
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
      />
      <SellerProfileClient sellerId={profile.id} />
    </>
  );
}
