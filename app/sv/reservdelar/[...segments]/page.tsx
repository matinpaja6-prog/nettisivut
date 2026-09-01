import {
  generateLocalizedCollectionMetadata,
  LocalizedSeoCollectionPage
} from "@/app/LocalizedSeoCollectionPage";

type PageProps = { params: Promise<{ segments: string[] }> };

export const revalidate = 3_600;
export const generateMetadata = (props: PageProps) =>
  generateLocalizedCollectionMetadata(props, "parts", "sv");
export default function Page(props: PageProps) {
  return <LocalizedSeoCollectionPage {...props} kind="parts" locale="sv" />;
}
