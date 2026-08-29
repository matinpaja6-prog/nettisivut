import "server-only";

import type { Company, Order, OrderItem } from "@/lib/commerce/types";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

type ProductAfterPayment = {
  id: string;
  company_id: string;
  name: string;
  price_cents: number;
  stock_quantity: number;
  active: boolean;
  created_at: string;
};

type ListingSnapshot = {
  id: string;
  seller_id: string | null;
  title: string;
  price: number;
  vehicle_type?: string | null;
  vehicle_subtype?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  engine_cc?: string | null;
  engine_model?: string | null;
  category?: string | null;
  subcategory?: string | null;
  part_number?: string | null;
  part_model?: string | null;
  condition?: string | null;
  location?: string | null;
  image_url?: string | null;
  listing_mode?: "single" | "multiple" | null;
  translations?: {
    _meta?: {
      commerce_product_id?: string | null;
      listing_mode?: "single" | "multiple" | null;
      publication_group_id?: string | null;
    } | null;
  } | null;
  created_at: string;
};

type PendingOrder = {
  id: string;
  stripe_checkout_session_id: string | null;
};

function milliseconds(value: string | null | undefined) {
  const result = new Date(value ?? "").getTime();
  return Number.isFinite(result) ? result : 0;
}

async function findSourceListing(
  admin: AdminClient,
  company: Company,
  product: ProductAfterPayment
) {
  const columns = [
    "id",
    "seller_id",
    "title",
    "price",
    "vehicle_type",
    "brand",
    "model",
    "year",
    "category",
    "subcategory",
    "image_url",
    "translations",
    "created_at"
  ].join(",");

  const direct = await admin
    .from("listings")
    .select(columns)
    .eq("seller_id", company.owner_user_id)
    .contains("translations", { _meta: { commerce_product_id: product.id } })
    .limit(2)
    .returns<ListingSnapshot[]>();
  if (direct.error) throw direct.error;
  if (direct.data?.[0]) return direct.data[0];

  // Old listings did not yet save commerce_product_id in their metadata.
  // Match the same way as the public catalog: owner + exact title + exact
  // price, then choose the row created closest to the commerce product.
  const legacy = await admin
    .from("listings")
    .select(columns)
    .eq("seller_id", company.owner_user_id)
    .eq("title", product.name)
    .eq("price", product.price_cents / 100)
    .limit(20)
    .returns<ListingSnapshot[]>();
  if (legacy.error) throw legacy.error;

  const productCreatedAt = milliseconds(product.created_at);
  return (legacy.data ?? [])
    .sort((left, right) => (
      Math.abs(milliseconds(left.created_at) - productCreatedAt) -
      Math.abs(milliseconds(right.created_at) - productCreatedAt)
    ))[0] ?? null;
}

async function archiveAndRemoveListing(
  admin: AdminClient,
  listing: ListingSnapshot,
  item: OrderItem,
  paidAt: string
) {
  const listingMode = listing.listing_mode === "multiple" ||
    listing.translations?._meta?.listing_mode === "multiple" ||
    Boolean(listing.translations?._meta?.publication_group_id)
    ? "multiple"
    : "single";
  const soldPrice = item.line_total_cents / 100;

  // Remove the listing from every public query before doing the archival work.
  // If an optional history column or the final delete ever fails, a paid item
  // must still never remain visible or purchasable.
  const hidden = await admin
    .from("listings")
    .update({
      is_sold: true,
      is_hidden: true,
      sold_price: soldPrice,
      sold_at: paidAt
    })
    .eq("id", listing.id)
    .eq("seller_id", listing.seller_id ?? "");
  if (hidden.error) throw hidden.error;

  const payload = {
    listing_id: listing.id,
    seller_id: listing.seller_id,
    buyer_id: null,
    title: listing.title || item.product_name || "Myyty tuote",
    price: Number(listing.price) || item.unit_price_cents / 100,
    sold_price: soldPrice,
    vehicle_type: listing.vehicle_type ?? null,
    vehicle_subtype: listing.vehicle_subtype ?? null,
    brand: listing.brand ?? null,
    model: listing.model ?? null,
    year: listing.year ?? null,
    engine_cc: listing.engine_cc ?? null,
    engine_model: listing.engine_model ?? null,
    category: listing.category ?? null,
    subcategory: listing.subcategory ?? null,
    part_number: listing.part_number ?? null,
    part_model: listing.part_model ?? null,
    condition: listing.condition ?? null,
    location: listing.location ?? null,
    image_url: listing.image_url ?? null,
    listing_mode: listingMode,
    sold_at: paidAt
  };

  let archive = await admin
    .from("sold_listings")
    .upsert(payload, { onConflict: "listing_id" });

  // Keep this compatible with installations that have not yet added every
  // optional sold-listing detail column.
  if (
    archive.error?.code === "42703" ||
    archive.error?.code === "PGRST204" ||
    /column .* does not exist|could not find .* column|column .* schema cache/i.test(archive.error?.message ?? "")
  ) {
    const {
      vehicle_subtype: _vehicleSubtype,
      engine_cc: _engineCc,
      engine_model: _engineModel,
      part_number: _partNumber,
      part_model: _partModel,
      condition: _condition,
      location: _location,
      listing_mode: _listingMode,
      ...legacyPayload
    } = payload;
    archive = await admin
      .from("sold_listings")
      .upsert(legacyPayload, { onConflict: "listing_id" });
  }
  // The sale history and exact paid price now live in sold_listings and the
  // order snapshots. The public/active listing row can therefore be removed.
  const removed = await admin
    .from("listings")
    .delete()
    .eq("id", listing.id)
    .eq("seller_id", listing.seller_id ?? "");
  if (removed.error) throw removed.error;
  if (archive.error) {
    // Never leave a paid one-off item publicly purchasable because an optional
    // sale-history migration is missing. The immutable order snapshot remains.
    console.error(`Sold listing ${listing.id} archive failed after public removal`, archive.error);
  }
  return listingMode;
}

async function expireCompetingCheckoutSessions(
  admin: AdminClient,
  order: Order,
  company: Company,
  soldOutProductIds: string[]
) {
  if (!company.stripe_account_id || soldOutProductIds.length === 0) return [];

  const conflictingItems = await admin
    .from("order_items")
    .select("order_id")
    .in("product_id", soldOutProductIds)
    .neq("order_id", order.id)
    .returns<Array<{ order_id: string }>>();
  if (conflictingItems.error) throw conflictingItems.error;

  const orderIds = Array.from(new Set((conflictingItems.data ?? []).map((row) => row.order_id)));
  if (orderIds.length === 0) return [];

  const pendingOrders = await admin
    .from("orders")
    .select("id,stripe_checkout_session_id")
    .in("id", orderIds)
    .eq("payment_status", "pending")
    .not("stripe_checkout_session_id", "is", null)
    .returns<PendingOrder[]>();
  if (pendingOrders.error) throw pendingOrders.error;

  const stripe = getStripe();
  const expiredOrderIds: string[] = [];
  for (const pendingOrder of pendingOrders.data ?? []) {
    if (!pendingOrder.stripe_checkout_session_id) continue;

    const currentSession = await stripe.checkout.sessions.retrieve(
      pendingOrder.stripe_checkout_session_id,
      {}
    );
    if (currentSession.status === "open") {
      await stripe.checkout.sessions.expire(
        pendingOrder.stripe_checkout_session_id,
        {}
      );
      expiredOrderIds.push(pendingOrder.id);
    } else if (currentSession.status === "expired") {
      expiredOrderIds.push(pendingOrder.id);
    }
  }

  if (expiredOrderIds.length > 0) {
    const cancelled = await admin
      .from("orders")
      .update({
        payment_status: "cancelled",
        payment_error: "Tuote myytiin toiseen tilaukseen ennen tämän maksun valmistumista."
      })
      .in("id", expiredOrderIds)
      .eq("payment_status", "pending");
    if (cancelled.error) throw cancelled.error;
  }

  return expiredOrderIds;
}

export async function closePaidOrderProducts(params: {
  order: Order;
  items: OrderItem[];
  company: Company;
}) {
  const admin = getSupabaseAdmin();
  const productIds = Array.from(new Set(
    params.items
      .map((item) => item.product_id)
      .filter((id): id is string => Boolean(id))
  ));
  if (productIds.length === 0) {
    return { soldOutProductIds: [], removedListingIds: [], deletedProductIds: [], expiredOrderIds: [] };
  }

  const products = await admin
    .from("products")
    .select("id,company_id,name,price_cents,stock_quantity,active,created_at")
    .in("id", productIds)
    .returns<ProductAfterPayment[]>();
  if (products.error) throw products.error;

  const soldOutProducts = (products.data ?? []).filter((product) => product.stock_quantity <= 0);
  const soldOutProductIds = soldOutProducts.map((product) => product.id);
  if (soldOutProductIds.length === 0) {
    return { soldOutProductIds: [], removedListingIds: [], deletedProductIds: [], expiredOrderIds: [] };
  }

  const deactivated = await admin
    .from("products")
    .update({ active: false })
    .in("id", soldOutProductIds);
  if (deactivated.error) throw deactivated.error;

  const paidAt = params.order.paid_at ?? new Date().toISOString();
  const removedListingIds: string[] = [];
  const singleProductIds: string[] = [];
  for (const product of soldOutProducts) {
    const item = params.items.find((candidate) => candidate.product_id === product.id);
    if (!item) continue;

    const listing = await findSourceListing(admin, params.company, product);
    if (!listing) continue;
    const listingMode = await archiveAndRemoveListing(admin, listing, item, paidAt);
    removedListingIds.push(listing.id);
    if (listingMode === "single") singleProductIds.push(product.id);
  }

  const expiredOrderIds = await expireCompetingCheckoutSessions(
    admin,
    params.order,
    params.company,
    soldOutProductIds
  );

  // A one-off listing has no reusable inventory after payment. Order items
  // retain their name, image, price and delivery snapshots, and their
  // product_id foreign key uses ON DELETE SET NULL, so the product row can be
  // removed without losing order history.
  if (singleProductIds.length > 0) {
    const deleted = await admin
      .from("products")
      .delete()
      .in("id", singleProductIds)
      .eq("company_id", params.company.id);
    if (deleted.error) throw deleted.error;
  }

  return { soldOutProductIds, removedListingIds, deletedProductIds: singleProductIds, expiredOrderIds };
}
