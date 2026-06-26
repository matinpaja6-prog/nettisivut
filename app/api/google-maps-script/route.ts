import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_LANGUAGES = new Set(["fi", "en", "sv", "no", "et"]);

export async function GET(request: Request) {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured." },
      { status: 404 }
    );
  }

  const requestUrl = new URL(request.url);
  const requestedLanguage = requestUrl.searchParams.get("language") ?? "fi";
  const language = ALLOWED_LANGUAGES.has(requestedLanguage)
    ? requestedLanguage
    : "fi";

  const googleUrl = new URL("https://maps.googleapis.com/maps/api/js");
  googleUrl.searchParams.set("key", apiKey);
  googleUrl.searchParams.set("libraries", "places");
  googleUrl.searchParams.set("language", language);

  const response = await fetch(googleUrl, {
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Google Maps script could not be loaded." },
      { status: 502 }
    );
  }

  return new NextResponse(await response.text(), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/javascript; charset=utf-8",
      "X-Robots-Tag": "noindex"
    }
  });
}
