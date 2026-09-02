import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);

// Exercise the real TS modules with isolated data sources, without contacting
// production or requiring another test runner dependency.
function loadModule(path, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(path, root), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  const loaded = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected dependency in ${path}: ${name}`);
  };
  const run = new Function("require", "module", "exports", ...Object.keys(globals), outputText);
  run(localRequire, loaded, loaded.exports, ...Object.values(globals));
  return loaded.exports;
}

const routes = loadModule("lib/routes.ts");
const features = loadModule("lib/features.ts");
const site = {
  PUBLIC_SITE_URL: "https://maskines.com",
  absoluteSiteUrl: (path) => new URL(path, "https://maskines.com").href
};
const listing = {
  id: "5d713c87-2ae8-4a14-a324-27f93ffed453",
  listing_number: 118,
  brand: "Lynx",
  model: "Rave RS",
  category: "Varaosat",
  subcategory: "Ruiskutusjärjestelmät",
  title: "Ruiskutusjärjestelmä",
  description: "Varaosa",
  created_at: "2026-08-10T12:00:00Z",
  image_url: "https://example.com/image.jpg",
  price: 100,
  is_hidden: false,
  is_sold: false
};
const vehicle = { ...listing, listing_number: 119, category: "Ajoneuvot" };
const fallback = { ...listing, listing_number: 120, brand: null, model: null };
const uuidFallback = { ...fallback, listing_number: null };
const fixtures = [
  listing, vehicle, fallback, uuidFallback,
  { ...listing, listing_number: 121, is_hidden: true },
  { ...listing, listing_number: 122, is_sold: true }
];
const canonical = "https://maskines.com/lynx/rave-rs/ruiskutusjarjestelmat/118";
const legacyPattern = /\/(?:ad|annons|annonse|ilmoitus)\//;
const data = {
  getListings: async () => ({ data: fixtures }),
  getListingDisplayNumber: async (_createdAt, number) => number ?? null,
  getListingById: async () => ({ data: listing })
};

const sitemapDependencies = {
  "@/lib/seo-collection-policy": { buildSeoCollectionCatalog: () => [] },
  "@/lib/sitemap-locales": loadModule("lib/sitemap-locales.ts"),
  "@/lib/features": features,
  "@/lib/routes": routes,
  "@/lib/site-url": site,
  "@/lib/supabase": data,
  "@/lib/supabase-admin": {
    getSupabaseAdmin: () => ({
      from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) })
    })
  },
  "@/lib/seo-search": {
    seoPartCollectionDescriptors: () => [],
    seoVehicleSearchQueries: () => []
  }
};
const { default: sitemap } = loadModule("app/sitemap.ts", sitemapDependencies);
const entries = await sitemap();
const listingEntries = entries.filter((entry) => entry.priority === 0.8);
assert.deepEqual(listingEntries.filter(entry => !/^\/(en|sv|no)(\/|$)/.test(new URL(entry.url).pathname)).map((entry) => entry.url), [
  canonical,
  "https://maskines.com/lynx/rave-rs/119",
  "https://maskines.com/ilmoitukset/120",
  `https://maskines.com/ilmoitukset/${listing.id}`
]);
assert.equal(new Set(entries.map((entry) => entry.url)).size, entries.length);
assert.equal(listingEntries.length,16);
for (const entry of entries) {
  for (const [language,url] of Object.entries(entry.alternates?.languages || {})) {
    if (language !== 'x-default') assert.deepEqual(entries.find(item=>item.url===url)?.alternates,entry.alternates);
  }
}
assert.ok(!legacyPattern.test(JSON.stringify(entries)));
assert.ok(listingEntries.every((entry) => entry.alternates.languages.en.startsWith("https://maskines.com/en/")));
assert.ok(!entries.some((entry) => entry.url === "https://maskines.com/yritykset"));
const restoredSitemap = loadModule("app/sitemap.ts", {
  ...sitemapDependencies,
  "@/lib/features": { COMPANY_DIRECTORY_VISIBLE: true }
}).default;
assert.ok((await restoredSitemap()).some((entry) => entry.url === "https://maskines.com/yritykset"));
assert.equal(listingEntries[0].images[0], listing.image_url);
assert.equal(listingEntries[0].lastModified.toISOString(), listing.created_at.replace("Z", ".000Z"));
console.log("PASS sitemap: current URLs only; hidden/sold excluded; images and dates retained");

const metadataModule = loadModule("app/listing/[id]/metadata.ts", {
  "@/lib/server-listing": { getServerListing: data.getListingById },
  "@/lib/routes": routes,
  "@/lib/site-url": site,
  "@/lib/supabase": data,
  "@/lib/server-locale": { getServerLocale: async () => "fi" },
  "@/lib/part-glossary": { glossaryTitle: text => text },
  "@/lib/listings": {
    isVehicleListing: () => false,
    formatPrice: (price) => `${price} €`,
    getListingSalePricing: (item) => ({ currentPrice: item.price })
  },
  "@/lib/listing-translations": { getLocalizedListingText: (item) => item }
}, { process: { env: { NODE_ENV: "production" } } });
const props = { params: Promise.resolve({ id: "id118" }) };
const metadata = await metadataModule.generateListingMetadata(props);
assert.equal(metadata.alternates.canonical, canonical);
assert.equal(metadata.alternates.languages.en, "/en/lynx/rave-rs/ruiskutusjarjestelmat/118");
assert.equal(metadata.openGraph.url, canonical);
assert.equal(metadata.robots.index, true);
for (const segment of ["ad", "annons", "annonse", "ilmoitus"]) {
  const alias = loadModule(`app/${segment}/[id]/page.tsx`, {
    "@/app/listing/[id]/metadata": metadataModule,
    "@/app/listing/[id]/page": { default: () => null }
  });
  const result = await alias.generateMetadata(props);
  assert.equal(result.alternates.canonical, canonical);
  assert.equal(result.openGraph.url, canonical);
  assert.ok(!legacyPattern.test(JSON.stringify(result)));
}
console.log("PASS metadata: canonical and social URLs agree for current and all legacy routes");

const { NextRequest } = require("next/server");
async function legacyResponse(rows) {
  const { middleware } = loadModule("middleware.ts", {
    "next/server": require("next/server"),
    "@/lib/features": features,
    "@/lib/routes": routes
  }, {
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.com", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" } },
    fetch: async () => new Response(JSON.stringify(rows), { status: 200 })
  });
  return middleware(new NextRequest("https://maskines.com/ad/id118"));
}
const redirect = await legacyResponse([listing]);
assert.equal(redirect.status, 308);
assert.equal(redirect.headers.get("location"), canonical);
assert.equal((await legacyResponse([])).status, 410);
assert.equal((await legacyResponse([{ ...listing, is_hidden: true }])).status, 410);
assert.equal((await legacyResponse([{ ...listing, is_sold: true }])).status, 410);
console.log("PASS legacy URLs: 308 to current listing; absent/hidden/sold return 410");

function directoryMiddleware(visible) {
  return loadModule("middleware.ts", {
    "next/server": require("next/server"),
    "@/lib/routes": routes,
    "@/lib/features": { COMPANY_DIRECTORY_VISIBLE: visible }
  }, { process: { env: {} } }).middleware;
}
const hiddenDirectory = directoryMiddleware(false);
for (const path of ["/yritykset", "/companies", "/foretag", "/bedrifter", "/liikkeet"]) {
  for (const suffix of ["", "/", "?yritys=test", "/test"]) {
    const response = await hiddenDirectory(new NextRequest(`https://maskines.com${path}${suffix}`));
    assert.equal(response.status, 404, `${path}${suffix}`);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("location"), null);
  }
}
for (const path of ["/", "/profiili/arcticparts", "/yritys", "/admin/commerce", "/api/commerce/company"]) {
  assert.notEqual((await hiddenDirectory(new NextRequest(`https://maskines.com${path}`))).status, 404, path);
}
assert.equal((await directoryMiddleware(true)(new NextRequest("https://maskines.com/yritykset"))).status, 200);
console.log("PASS company directory: all aliases hidden, unrelated routes intact, one flag restores access");
console.log(`Listing SEO checks passed (${fileURLToPath(root)}).`);
