import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
function load(file, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(file, root), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)(
    name => { if (name in dependencies) return dependencies[name]; throw new Error(file + " requires " + name); },
    compiledModule, compiledModule.exports, ...Object.values(globals)
  );
  return compiledModule.exports;
}
const routes = load("lib/routes.ts");
for (const [locale, prefix] of [["fi",""],["en","/en"],["sv","/sv"],["no","/no"]]) {
  assert.equal(routes.translateLocalizedPath("/", locale), prefix || "/");
  assert.equal(routes.canonicalPathFromLocalized(routes.pagePath("sell",locale)), "/sell");
  assert.equal(routes.localeFromPath(routes.pagePath("sell",locale)), locale);
  assert.equal(routes.localizeHref("/?q=123#results",locale), (prefix || "/") + "?q=123#results");
  assert.equal(routes.localizeHref("/api/commerce/products",locale), "/api/commerce/products");
  assert.equal(routes.localizeHref("/logo.png",locale), "/logo.png");
  assert.equal(routes.localizeHref("https://example.com/",locale), "https://example.com/");
  assert.equal(routes.listingPath({id:"id123",brand:"Yamaha",model:"DT",subcategory:"Kaasuttimet"},locale), prefix + "/yamaha/dt/kaasuttimet/123");
}
assert.equal(routes.translateLocalizedPath("/sv/salj","en"),"/en/sell");
assert.equal(routes.localizeHref("/sv/salj","en"),"/sv/salj");
assert.equal(routes.localeFromPath("/eng"),"en");
console.log("PASS routes: prefixes, query/hash, explicit locale and non-page URLs");

const glossary = load("lib/part-glossary.ts");
const translations = load("lib/listing-translations.ts", {"./part-glossary":glossary});
const listing = { title:"Dellortto 32mm kassutin", description:"OEM 8JP-17641-00. 32mm.", translations:{en:{title:"Dellortto 32mm water bottle",description:"OEM 8JP-17641-00. 32mm."}} };
assert.equal(translations.getLocalizedListingText(listing,"en").title,"Dellortto 32mm carburetor");
assert.equal(translations.getLocalizedListingText(listing,"fi").title,listing.title);
assert.equal(translations.getLocalizedListingText(listing,"sv").title,"Dellortto 32mm förgasare");
assert.equal(translations.getLocalizedListingText(listing,"no").title,"Dellortto 32mm forgasser");
assert.equal(glossary.validTechnicalTranslation("OEM 8JP-17641-00", "OEM 8JP-17642-00","en"),false);
assert.equal(glossary.glossaryTitle("Ski-Doo 850 E-TEC Voca 80-90","en"),"Ski-Doo 850 E-TEC Voca 80-90");
console.log("PASS translations: carburetor regression, originals, OEM/model/measurement preservation");

const query = load("lib/listing-query.ts", {"./part-glossary":glossary});
assert.ok(query.listingSearchClauses("carburetor")[0].includes("kassutin"));
assert.ok(query.listingSearchClauses("8JP1764100")[0].includes("part_number.ilike.*8*J*P*1*7*6*4*1*0*0*"));
assert.ok(query.listingSearchClauses("ID 163")[0].includes("listing_number.eq.163"));
assert.ok(!query.safeSearchTerm("x),is_hidden.eq.true").includes(","));
assert.ok(query.listingSearchClauses("1 2 3 4 5 6 7 8 9").length <= 8);
console.log("PASS search: server-side candidate clauses, OEM, IDs and operator sanitization");

const { NextRequest } = require("next/server");
const middleware = load("middleware.ts", {
  "next/server":require("next/server"), "@/lib/routes":routes, "@/lib/features":{COMPANY_DIRECTORY_VISIBLE:false}
}, {process:{env:{}},fetch:async()=>new Response("[]")}).middleware;
for (const [path, locale, rewrite] of [["/en","en","/"],["/sv/salj","sv","/sell"],["/no/annonser","no","/listing"]]) {
  const response = await middleware(new NextRequest("https://maskines.com"+path, {headers:{cookie:"locale=fi","x-maskines-locale":"fi"}}));
  assert.equal(response.status,200,path);
  assert.equal(new URL(response.headers.get("x-middleware-rewrite")).pathname,rewrite);
  assert.equal(response.headers.get("x-middleware-request-x-maskines-locale"),locale);
}
assert.equal((await middleware(new NextRequest("https://maskines.com/en/api/commerce/checkout"))).status,404);
assert.equal((await middleware(new NextRequest("https://maskines.com/en/admin"))).status,404);
assert.match((await middleware(new NextRequest("https://maskines.com/en/sell"))).headers.get("x-robots-tag"),/noindex/);
assert.equal(new URL((await middleware(new NextRequest("https://maskines.com/eng"))).headers.get("location")).pathname,"/en");
assert.equal(new URL((await middleware(new NextRequest("https://maskines.com/?lang=sv"))).headers.get("location")).pathname,"/sv");
console.log("PASS middleware: URL wins over cookie/header, alias redirects, API isolation and private noindex");

const memory = new Map();
const events = [];
const cart = load("lib/commerce/cart.ts", {"@/lib/analytics":{trackAnalyticsEvent:()=>{}}},{
  window:{localStorage:{getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)}, dispatchEvent:event=>events.push(event.type)},
  CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}}
});
assert.deepEqual(cart.readCart(),[]);
cart.addCartProduct("product1","company1");
assert.equal(cart.readCart().reduce((sum,row)=>sum+row.quantity,0),1);
cart.addCartProduct("product1","company1",2);
assert.equal(cart.readCart()[0].quantity,3);
cart.saveCart([]);
assert.deepEqual(cart.readCart(),[]);
assert.equal(events.length,3);
const topbar = readFileSync(new URL("app/components/UniversalTopbar.tsx",root),"utf8");
assert.equal((topbar.match(/cartQuantity > 0 \? <CartHoverPreview/g)||[]).length,2);
console.log("PASS cart: empty -> nonempty -> empty, event updates and both header variants");

const auto = readFileSync(new URL("app/components/AutoTranslate.tsx",root),"utf8");
assert.ok(!auto.includes('fetch("/api/translate-ui"'));
assert.ok(!auto.includes("MutationObserver"));
assert.ok(!readFileSync(new URL("app/layout.tsx",root),"utf8").includes("<AutoTranslate"));
const home = readFileSync(new URL("app/HomeClient.tsx",root),"utf8");
assert.ok(!home.includes("fullSearchCatalogRequestedRef"));
assert.ok(!home.includes("ensureListingTranslations("));
assert.ok(home.includes("INITIAL_LISTING_FETCH_LIMIT = 24"));
assert.ok(topbar.includes("limit: 24"));
assert.ok(!topbar.includes("marketplaceCatalogRequestedRef"));
console.log("PASS load guards: bounded home request, no view-time translation API");

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const LanguageContext = React.createContext({locale:"fi",setLocale:()=>{}});
const i18n = load("lib/i18n.ts", {react:React,"@/app/components/LanguageProvider":{LanguageContext}});
const uiTranslations = load("lib/ui-translations.ts", {
  "@/lib/i18n":i18n,
  "@/lib/generated-ui-translations":load("lib/generated-ui-translations.ts"),
  "@/lib/commerce-ui-translations":load("lib/commerce-ui-translations.ts")
});
const UiText = load("app/components/UiText.tsx", {"@/lib/i18n":i18n,"@/lib/ui-translations":uiTranslations}).default;
for (const [locale, expected] of [["fi","Suodata ilmoituksia"],["en","Filter listings"],["sv","Filtrera annonser"],["no","Filtrer annonser"]]) {
  const html = renderToStaticMarkup(React.createElement(LanguageContext.Provider,{value:{locale,setLocale:()=>{}}},React.createElement(UiText,{text:"Suodata ilmoituksia"})));
  assert.equal(html,expected);
}
for (const locale of ["en","sv","no"]) {
  for (const source of ["Myyjätyyppi","Kaikki myyjät","Tervetuloa takaisin","Kirjaudu sisään jatkaaksesi ilmoituksen luontia.","Lisää suodattimia","Minimi","Maksimi"]) {
    assert.ok(uiTranslations.getStaticTranslation(locale,source), `${locale}: ${source}`);
  }
}
const responsiveStyles = readFileSync(new URL("app/styles/marketplace-improvements.css",root),"utf8");
assert.match(responsiveStyles,/grid-auto-rows: auto !important/);
assert.match(responsiveStyles,/grid-template-rows: 160px minmax\(164px, auto\)/);
let allowed = false;
const analyticsEvents = [];
const analytics = load("lib/analytics.ts", {"./cookie-consent":{readCookieConsentSettings:()=>({analytics:allowed})},"./measurement-config":load("lib/measurement-config.ts")}, {window:{gtag:(...args)=>analyticsEvents.push(args)},process:{env:{NEXT_PUBLIC_GA_MEASUREMENT_ID:"G-TEST1234"}}});
analytics.trackAnalyticsEvent("search");
assert.equal(analyticsEvents.length,0);
allowed=true;
analytics.trackAnalyticsEvent("search");
assert.equal(analyticsEvents.length,1);
allowed=false;
analytics.trackAnalyticsEvent("search");
assert.equal(analyticsEvents.length,1);
console.log("PASS SSR text: all four locales render correctly; analytics require active consent");
