import {
  generateLocalizedCollectionMetadata,
  LocalizedSeoCollectionPage
} from "@/app/LocalizedSeoCollectionPage";

type PageProps = { params: Promise<{ slug: string }> };

export const revalidate = 3_600;
export const generateMetadata = (props: PageProps) =>
  generateLocalizedCollectionMetadata(props, "parts", "no");
export default function Page(props: PageProps) {
  return <LocalizedSeoCollectionPage {...props} kind="parts" locale="no" />;
}
