import { notFound, permanentRedirect } from "next/navigation";


import { storefrontMetadata } from "@/lib/commerce/storefront-metadata";
import { resolvePublicProfile } from "@/lib/public-profile-route";
import { profilePath } from "@/lib/routes";
import { COMPANY_DIRECTORY_VISIBLE } from "@/lib/features";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return storefrontMetadata(id);
}

export default async function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await resolvePublicProfile(id);
  if (profile) permanentRedirect(profilePath(profile.id, profile.name, "fi"));

  if (!COMPANY_DIRECTORY_VISIBLE) notFound();
  permanentRedirect("/liikkeet");
}
