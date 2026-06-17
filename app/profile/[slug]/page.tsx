import SellerProfileClient from "@/app/seller/[id]/seller-profile-client";

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return <SellerProfileClient sellerId={decodeURIComponent(slug)} />;
}
