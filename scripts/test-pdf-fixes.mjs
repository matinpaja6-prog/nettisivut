import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createTestLoader } from './test-module-loader.mjs';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const LanguageContext = React.createContext({locale:'fi',setLocale:()=>{}});
const load = createTestLoader({
  'react/jsx-runtime':require('react/jsx-runtime'),
  'lucide-react':require('lucide-react'),
  '@/app/components/LanguageProvider':{LanguageContext},
  '@/app/components/LocalizedLink':{default:props=>React.createElement('a',props)},
});
const source = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const query = load('lib/listing-query.ts');
const translation = load('lib/listing-translations.ts');
const glossary = load('lib/part-glossary.ts');
const { marketplaceCopy:copy, storefrontPaymentCopy } = load('lib/marketplace-copy.ts');
const fixture = {listing_number:163,title:'Dellortto 32mm kassutin',description:'Täysin toimiva ja hyvä kuntoinen',part_number:'420-685-756'};
for (const term of ['carburetor','förgasare','forgasser','kaasutin']) {
  assert.equal(query.listingMatchesQuery(fixture,term),true,term);
  assert.ok(!query.listingSearchClauses(term).join(',').includes('part_model.'));
}
assert.equal(query.listingMatchesQuery(fixture,'420685756'),true);
assert.equal(query.listingMatchesQuery(fixture,'ID 163'),true);
assert.equal(query.listingMatchesQuery(fixture,'carburetor Yamaha'),false);
assert.equal(query.listingMatchesQuery(fixture,'engine'),false);
assert.equal(query.listingMatchesQuery(fixture,''),false);
assert.equal(glossary.glossaryTitle('Yamaha DT kokonainen moottori / täydelliset moottorit','en'),'Yamaha DT complete engine');
assert.equal(glossary.glossaryTitle('Skidoo Rs tankki penkki kokonaisuus','en'),'Skidoo Rs fuel tank seat assembly');
assert.equal(translation.getLocalizedListingText(fixture,'en').description,'Fully functional and in good condition');
assert.equal(glossary.glossaryDescription('Täysin toimiva ja hyvä kuntoinen\n\nToimitustapa: Nouto\nOEM 123','en'),'Fully functional and in good condition\n\nToimitustapa: Nouto\nOEM 123');
assert.equal(translation.getLocalizedListingText({...fixture,description:'OEM 123 tuntematon kuvaus'},'en').description,'OEM 123 tuntematon kuvaus');
assert.equal(glossary.glossaryTitle('OEM 32 / 32 8JP-17641-00 80-90','en'),'OEM 32 / 32 8JP-17641-00 80-90');
console.log('PASS PDF search/translation regressions: aliases, real-schema columns, OEMs, duplicate phrases and unchanged unknown descriptions');

const Privacy = load('app/privacy/page.tsx').default;
const Faq = load('app/faq/page.tsx').default;
const Terms = load('app/terms/page.tsx').default;
for (const locale of ['fi','en','sv','no']) {
  assert.equal(storefrontPaymentCopy(locale,0,3),copy[locale].inquiry);
  assert.equal(storefrontPaymentCopy(locale,2,0),copy[locale].checkout);
  assert.equal(storefrontPaymentCopy(locale,2,3),copy[locale].mixed);
  assert.match(copy[locale].paymentFaq,/Stripe/);
  const render = Component => renderToStaticMarkup(React.createElement(LanguageContext.Provider,{value:{locale,setLocale:()=>{}}},React.createElement(Component)));
  const privacy = render(Privacy);
  assert.ok(privacy.includes('3576714-8'));
  assert.ok(privacy.includes('Linnuntie 3 A 2'));
  assert.ok(!privacy.includes('täydennetään') && !privacy.includes('will be added'));
  assert.ok(privacy.includes('info@maskines.com'));
  assert.ok(!privacy.includes('maskiner.com'));
  assert.ok(!privacy.includes('GDPR compliant') && !privacy.includes('GDPR -yhteensopiva'));
  if (locale !== 'fi') assert.ok(!privacy.includes('Rekisterinpitäjä') && !privacy.includes('Tietosuojan tiivistelmä'));
  const faq = render(Faq);
  assert.ok(faq.includes(copy[locale].paymentGuide));
  if (locale !== 'fi') assert.ok(!faq.includes('Ostajan ohjeet') && !faq.includes('Valitse aihe'));
  const terms = render(Terms);
  assert.ok(terms.includes('Arctic Parts Oy'));
}
assert.ok(!source('app/seller/[id]/seller-profile-client.tsx').includes('Kauppasi on suojattu Maskinesin palvelussa.'));
assert.ok(source('app/HomeClient.tsx').includes('<h1 className="marketplace-page-title">{marketplaceCopy[locale].homeTitle}</h1>'));
assert.ok(!source('app/HomeClient.tsx').includes('marketplace-home-intro'));
assert.ok(source('app/HomeClient.tsx').includes('<h2 className="home-latest-heading">'));
assert.equal((source('app/components/UniversalTopbar.tsx').match(/<CreateListingAction \/>/g)||[]).length,2,'Both guest and member headers retain the create-listing action');
assert.ok(source('app/sell/page.tsx').includes('listing-quality-checklist'));
// Inspect the dedicated guest branch, preserving separate signed-in messaging.
const bottomNav = source('app/components/BottomNav.tsx');
const guestMarkup = bottomNav.slice(bottomNav.indexOf('className="bottom-nav bottom-nav-main bottom-nav-guest"'),bottomNav.indexOf('\n  return (\n    <>',bottomNav.indexOf('className="bottom-nav bottom-nav-main bottom-nav-guest"')));
assert.ok(guestMarkup.includes('{copy.login}'));
assert.ok(guestMarkup.indexOf('{copy.login}') < guestMarkup.indexOf('{copy.filter}'),'Guest login precedes filter');
assert.ok(!guestMarkup.includes('{copy.profile}'));
assert.ok(!guestMarkup.includes('{copy.messages}'));
assert.ok(!source('app/components/UniversalTopbar.tsx').includes('className="universal-mobile-login-button"'));
console.log('PASS PDF UI regressions: four-language help/privacy, three purchase modes, truthful trust copy, headings and seller guidance');

const ui = load('lib/ui-translations.ts');
for (const locale of ['en','sv','no']) {
  const contact = ui.getStaticTranslation(locale,'Näihin ehtoihin sovelletaan Suomen lakia. Kysymykset: info@maskines.com');
  assert.ok(contact?.includes('info@maskines.com'));
}
for (const mode of ['development','production']) {
  for (const locale of ['fi','en','sv','no']) {
    const metadataLoad = createTestLoader({
      '@/lib/supabase':{getListingDisplayNumber:async()=>163},
      '@/lib/server-listing':{getServerListing:async()=>({data:fixture})},
      '@/lib/server-locale':{getServerLocale:async()=>locale},
      '@/lib/listings':{formatPrice:()=> '50 €',getListingSalePricing:()=>({currentPrice:50}),isVehicleListing:()=>false},
    },{process:{env:{NODE_ENV:mode}}});
    const result = await metadataLoad('app/listing/[id]/metadata.ts').generateListingMetadata({params:Promise.resolve({id:'163'})});
    assert.ok(result.title.absolute.includes('32mm'));
    assert.equal(result.title.absolute.match(/Maskines/g).length,1);
    assert.ok(!result.title.absolute.startsWith('Ilmoitus'));
    const unavailableLoad = createTestLoader({
      '@/lib/supabase':{},
      '@/lib/server-listing':{getServerListing:async()=>({data:null})},
      '@/lib/server-locale':{getServerLocale:async()=>locale},
      '@/lib/listings':{},
    },{process:{env:{NODE_ENV:mode}}});
    const unavailable = await unavailableLoad('app/listing/[id]/metadata.ts').generateListingMetadata({params:Promise.resolve({id:'163'})});
    assert.equal(unavailable.robots.index,false);
    assert.equal(unavailable.title.absolute.match(/Maskines/g).length,1);
    assert.ok(unavailable.title.absolute.startsWith({fi:'Ilmoitus',en:'Listing',sv:'Annons',no:'Annonse'}[locale]));
  }
}
console.log('PASS listing metadata: product-specific titles in dev and production, one brand suffix, all locales');
