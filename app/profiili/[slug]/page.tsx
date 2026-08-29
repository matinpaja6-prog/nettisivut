import { PublicProfileRoutePage } from "@/app/PublicProfileRoutePage";
import { storefrontMetadata } from "@/lib/commerce/storefront-metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return storefrontMetadata(decodeURIComponent(slug), "fi");
}

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return <PublicProfileRoutePage identifier={decodeURIComponent(slug)} locale="fi" />;
}
