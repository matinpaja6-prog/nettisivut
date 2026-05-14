import SellerProfileClient from "./seller-profile-client";

export default async function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <SellerProfileClient sellerId={id} />;
}
