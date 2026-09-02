import SeoCollectionPage, { seoCollectionMetadata } from "./SeoCollectionPage";
import type { SeoCollectionKind, SeoSearchLocale } from "@/lib/seo-search";

type Props = { params: Promise<{ slug?: string; segments?: string[] }> };
async function segments(params: Props["params"]) {
  const value = await params;
  return value.segments?.length ? value.segments : value.slug ? [value.slug] : [];
}
export async function generateLocalizedCollectionMetadata({ params }: Props, kind: SeoCollectionKind, locale: Exclude<SeoSearchLocale,"fi">) {
  return seoCollectionMetadata(await segments(params), kind, locale);
}
export async function LocalizedSeoCollectionPage({ params, kind, locale }: Props & { kind: SeoCollectionKind; locale: Exclude<SeoSearchLocale,"fi"> }) {
  return <SeoCollectionPage segments={await segments(params)} kind={kind} locale={locale} />;
}
