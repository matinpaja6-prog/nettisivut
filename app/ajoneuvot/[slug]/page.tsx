import SeoCollectionPage, { seoCollectionMetadata } from "@/app/SeoCollectionPage";

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  return seoCollectionMetadata([(await params).slug], "vehicles", "fi");
}
export default async function VehiclesCollection({ params }: Props) {
  return <SeoCollectionPage segments={[(await params).slug]} kind="vehicles" locale="fi" />;
}
