import { PublicProfileRoutePage } from "@/app/PublicProfileRoutePage";
import { storefrontMetadata } from "@/lib/commerce/storefront-metadata";
import { resolvePublicProfile } from "@/lib/public-profile-route";
import { normalizeRouteLocale, profilePath } from "@/lib/routes";
import { getServerLocale } from "@/lib/server-locale";
import { notFound, permanentRedirect } from "next/navigation";


export const dynamic = "force-dynamic";
export const revalidate = 0;

async function currentLocale() {
  return await getServerLocale();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return storefrontMetadata(decodeURIComponent(slug), await currentLocale());
}

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const identifier = decodeURIComponent(slug);
  const locale = await currentLocale();
  const profile = await resolvePublicProfile(identifier);
  if (!profile) notFound();
  if (identifier !== profile.slug) permanentRedirect(profilePath(profile.id, profile.name, locale));

  return <PublicProfileRoutePage identifier={profile.slug} locale={locale} />;
}
