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
  image_url?: string | null;
  image_urls?: string[] | null;
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

function storageObjectFromPublicUrl(value: string) {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return null;
  }

  try {
    const url = new URL(value);
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

    return bucket && path ? { bucket, path } : null;
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
    const object = storageObjectFromPublicUrl(url);
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
      .select("id,seller_id,image_url,image_urls")
      .eq("id", id)
      .maybeSingle<ListingImageFields & { id: string; seller_id: string }>();

    if (listingError) throw listingError;
    if (!listing) {
      return NextResponse.json({ error: "Ilmoitusta ei löytynyt." }, { status: 404 });
    }

    if (listing.seller_id !== userId) {
      return NextResponse.json({ error: "Ei oikeutta poistaa tätä ilmoitusta." }, { status: 403 });
    }

    const { error: deleteError } = await admin
      .from("listings")
      .delete()
      .eq("id", id)
      .eq("seller_id", userId);

    if (deleteError) throw deleteError;

    const imageCleanupErrors = await deleteListingImages(admin, listing);
    return NextResponse.json({
      ok: true,
      imageCleanupErrors
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ilmoituksen poisto epäonnistui." },
      { status: 500 }
    );
  }
}
