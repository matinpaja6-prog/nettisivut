import SeoCollectionPage, { seoCollectionMetadata } from "@/app/SeoCollectionPage";

export const revalidate = 300;
type Props = { params: Promise<{ segments: string[] }> };
export async function generateMetadata({ params }: Props) {
  return seoCollectionMetadata((await params).segments, "parts", "fi");
}
export default async function PartsCollection({ params }: Props) {
  return <SeoCollectionPage segments={(await params).segments} kind="parts" locale="fi" />;
}
