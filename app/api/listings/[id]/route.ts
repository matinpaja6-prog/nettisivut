import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

type ListingImageFields = {
  seller_id?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  translations?: {
    _meta?: {
      commerce_product_id?: string | null;
    } | null;
  } | null;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" && token ? token : null;
}

function getClient(key: string) {
  return createClient(supabaseUrl!, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function storageObjectFromPublicUrl(value: string, ownerId?: string | null) {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return null;
  }

  try {
    const url = new URL(value);
    if (!supabaseUrl || url.origin !== new URL(supabaseUrl).origin) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex = parts.findIndex((part, index) =>
      part === "object" &&
      parts[index - 2] === "storage" &&
      parts[index - 1] === "v1"
    );

    if (objectIndex === -1) return null;

    const visibility = parts[objectIndex + 1];
    if (visibility !== "public" && visibility !== "sign") return null;

    const bucket = parts[objectIndex + 2];
    const path = parts
      .slice(objectIndex + 3)
      .map((part) => decodeURIComponent(part))
      .join("/");

    if (bucket !== "listing-images" || !path) return null;
    if (ownerId && path.split("/")[0] !== ownerId) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

function collectListingImages(listing: ListingImageFields | null) {
  const urls = Array.from(new Set([
    listing?.image_url,
    ...(Array.isArray(listing?.image_urls) ? listing.image_urls : [])
  ].filter((value): value is string => Boolean(value))));

  const byBucket = new Map<string, Set<string>>();
  for (const url of urls) {
    const object = storageObjectFromPublicUrl(url, listing?.seller_id);
    if (!object) continue;

    const paths = byBucket.get(object.bucket) ?? new Set<string>();
    paths.add(object.path);
    byBucket.set(object.bucket, paths);
  }

  return byBucket;
}

async function deleteListingImages(
  admin: ReturnType<typeof getClient>,
  listing: ListingImageFields | null
) {
  const errors: string[] = [];
  const byBucket = collectListingImages(listing);

  for (const [bucket, paths] of byBucket) {
    if (paths.size === 0) continue;

    const { error } = await admin.storage.from(bucket).remove([...paths]);
    if (error) errors.push(error.message);
  }

  return errors;
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase server -asetukset puuttuvat." },
      { status: 500 }
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Kirjautuminen puuttuu." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Ilmoitus puuttuu." }, { status: 400 });
  }

  try {
    const authClient = getClient(anonKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const userId = userData.user?.id;

    if (userError || !userId) {
      return NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 });
    }

    const admin = getClient(serviceRoleKey);
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id,seller_id,image_url,image_urls,translations")
      .eq("id", id)
      .maybeSingle<ListingImageFields & { id: string; seller_id: string }>();

    if (listingError) throw listingError;
    if (!listing) {
      return NextResponse.json({ error: "Ilmoitusta ei löytynyt." }, { status: 404 });
    }

    if (listing.seller_id !== userId) {
      return NextResponse.json({ error: "Ei oikeutta poistaa tätä ilmoitusta." }, { status: 403 });
    }

    const commerceProductId = listing.translations?._meta?.commerce_product_id?.trim() ?? "";
    let ownedCompanyId = "";
    if (commerceProductId) {
      const { data: company, error: companyError } = await admin
        .from("companies")
        .select("id")
        .eq("owner_user_id", userId)
        .maybeSingle<{ id: string }>();
      if (companyError) throw companyError;
      ownedCompanyId = company?.id ?? "";

      if (ownedCompanyId) {
        // Hide the linked checkout product before removing the source listing.
        // This prevents an orphan product from briefly or permanently returning
        // to the company storefront if a later cleanup step fails.
        const { error: hideProductError } = await admin
          .from("products")
          .update({ active: false, stock_quantity: 0 })
          .eq("id", commerceProductId)
          .eq("company_id", ownedCompanyId);
        if (hideProductError) throw hideProductError;
      }
    }

    const { data: deletedListing, error: deleteError } = await admin
      .from("listings")
      .delete()
      .eq("id", id)
      .eq("seller_id", userId)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (deleteError) throw deleteError;
    if (!deletedListing?.id) {
      return NextResponse.json(
        { error: "Ilmoitusta ei poistettu. Yritä uudelleen." },
        { status: 409 }
      );
    }

    if (commerceProductId && ownedCompanyId) {
      const { count: orderItemCount, error: orderItemError } = await admin
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", commerceProductId);
      if (orderItemError) throw orderItemError;

      // Order rows retain immutable product snapshots. Products without order
      // history can be removed completely; purchased ones remain archived but
      // inactive and at zero stock.
      if ((orderItemCount ?? 0) === 0) {
        const { error: productDeleteError } = await admin
          .from("products")
          .delete()
          .eq("id", commerceProductId)
          .eq("company_id", ownedCompanyId);
        if (productDeleteError) throw productDeleteError;
      }
    }

    const imageCleanupErrors = await deleteListingImages(admin, listing);
    return NextResponse.json({
      ok: true,
      commerceProductRemoved: Boolean(commerceProductId),
      imageCleanupErrors
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ilmoituksen poisto epäonnistui." },
      { status: 500 }
    );
  }
}
