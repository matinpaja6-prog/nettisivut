"use client";

import type { Listing } from "@/lib/listings";
import ListingSalePrice from "./ListingSalePrice";

export default function CollectionPrice({ listing }: { listing: Pick<Listing, "price" | "translations"> }) {
  return <ListingSalePrice listing={listing} />;
}
