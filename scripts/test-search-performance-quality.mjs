import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTestLoader} from './test-module-loader.mjs';

const source = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const load = createTestLoader();
const glossary = load('lib/part-glossary.ts');
const text = load('lib/listing-translations.ts');
for (const [locale,term,phrase] of [
  ['en','chaincase','Shock absorbers are not included in the price'],
  ['sv','kedjehus','Stötdämparna ingår inte i priset'],
  ['no','kjedehus','Støtdemperne er ikke inkludert i prisen']
]) {
  assert.equal(glossary.glossaryTitle('Ketjukotelo 123',locale),term+' 123');
  assert.equal(glossary.glossaryDescription('Iskunvaimentimet ei kuulu hintaan.',locale),phrase+'.');
  assert.equal(glossary.validTechnicalTranslation('Iskunvaimentimet ei kuulu hintaan',phrase,locale),true);
  assert.equal(glossary.validTechnicalTranslation('Iskunvaimentimet ei kuulu hintaan','Includes shock absorbers',locale),false);
  assert.equal(glossary.validTechnicalTranslation('OEM 123 testaamaton','OEM 123 excellent',locale),false);
  assert.equal(glossary.validTechnicalTranslation('OEM 123 ei sovi','OEM 123 compatible',locale),false);
  assert.equal(glossary.validTechnicalTranslation('OEM 123 vain nouto','OEM 123 shipping available',locale),false);
  assert.equal(glossary.validTechnicalTranslation('OEM 123 viallinen','OEM 123 perfect',locale),false);
  assert.equal(glossary.validTechnicalTranslation('OEM 123 ei sovi','OEM 123 ei sovi',locale),true);
  assert.equal(text.getLocalizedListingText({title:'OEM 123',description:'Testaamaton',translations:{[locale]:{title:'OEM 123',description:'Excellent'}}},locale).description,'Testaamaton');
}
assert.equal(glossary.validTechnicalTranslation('Untested 123','Testattu 123','fi','en'),false);
assert.equal(glossary.validTechnicalTranslation('Untested 123','Testaamaton 123','fi','en'),true);
assert.equal(glossary.validTechnicalTranslation('OEM 123','OEM 123 456','en'),false);
assert.equal(glossary.validTechnicalTranslation('32mm','32cm','en'),false);
console.log('PASS technical translations: curated terms, exclusions, condition, fit, delivery, exact numbers and original fallback');

const config=load('lib/measurement-config.ts');
assert.equal(config.measurementId(' G-AB1234 ','analytics'),'G-AB1234');
for (const id of [undefined,'G-XXXXXXXXXX','G-YOURID','G-EXAMPLE123','AW-123456']) assert.equal(config.measurementId(id,'analytics'),'');
assert.equal(config.measurementId('AW-123456','ads'),'AW-123456');
assert.equal(config.googleVerification('google-site-verification=Abcd1234_567890xyz-ZZ'),'Abcd1234_567890xyz-ZZ');
assert.equal(config.googleVerification('your-search-console-verification-token'),'');
const document={documentElement:{dataset:{maskinesLocalVitals:'null'}}};
const localWindow={location:{hostname:'localhost'}};
const local=createTestLoader({}, {window:localWindow,document})('lib/measurement-config.ts');
assert.equal(local.measurementDebugParameters().debug_mode,true);
local.recordLocalMeasurementState({gaConfigured:true,analyticsConsent:false});
assert.equal(JSON.parse(document.documentElement.dataset.maskinesMeasurement).analyticsConsent,false);
local.recordLocalWebVital({name:'LCP',value:123,rating:'good'});
assert.equal(JSON.parse(document.documentElement.dataset.maskinesLocalVitals).LCP.value,123);
localWindow.location.hostname='maskines.com';
assert.equal(Object.keys(local.measurementDebugParameters()).length,0,'Production must not enable debug mode');
local.recordLocalMeasurementState({analyticsConsent:true});
assert.equal(JSON.parse(document.documentElement.dataset.maskinesMeasurement).analyticsConsent,false,'No local diagnostic DOM state on production');
local.recordLocalWebVital({name:'LCP',value:999});
assert.equal(JSON.parse(document.documentElement.dataset.maskinesLocalVitals).LCP.value,123);

// Exercise consent changes without React DOM, Google, cookies or network.
const refs=[];let refIndex=0,effects=[],consent={analytics:false,personalization:false};
const scripts=[];const browser={location:{origin:'http://localhost:3000',pathname:'/en'},addEventListener(){},removeEventListener(){}};
const measurement=createTestLoader({
  react:{useRef(value){const at=refIndex++;return refs[at] ||= {current:value};},useState:()=>[0,()=>{}],useCallback:callback=>callback,useEffect:callback=>effects.push(callback)},
  'next/navigation':{usePathname:()=>'/en',useSearchParams:()=>new URLSearchParams()},
  'next/web-vitals':{useReportWebVitals(){}},
  '@/lib/cookie-consent':{COOKIE_CONSENT_EVENT:'consent',readCookieConsentSettings:()=>consent},
  '@/lib/analytics':{trackAnalyticsEvent(){},measurementPage:()=>({page_path:'/en',language:'en'})}
},{window:browser,document:{createElement:()=>({dataset:{}}),head:{appendChild:script=>scripts.push(script)}},process:{env:{NEXT_PUBLIC_GA_MEASUREMENT_ID:'G-AB1234',NEXT_PUBLIC_GOOGLE_ADS_ID:'AW-123456'}}})('app/components/GoogleMeasurement.tsx').default;
function render(){refIndex=0;effects=[];measurement();effects.forEach(effect=>effect());}
render();assert.equal(scripts.length,0);
consent={analytics:false,personalization:true};render();
assert.equal(scripts.length,1);assert.match(scripts[0].src,/id=AW-123456$/);
// gtag.js dispatches its command API only for Arguments objects. A plain
// rest-parameter array is a data-layer method invocation, not a gtag command.
assert.ok(browser.dataLayer.every(command=>Object.prototype.toString.call(command)==='[object Arguments]'),'Google tag commands must use Arguments objects, not arrays');
assert.ok(!browser.dataLayer.some(args=>args[0]==='config'&&args[1]==='G-AB1234'));
assert.equal(browser['ga-disable-G-AB1234'],true);
consent={analytics:true,personalization:false};render();
assert.equal(scripts.length,1);
assert.equal(browser.dataLayer.filter(args=>args[0]==='config'&&args[1]==='G-AB1234').length,1);
assert.equal(browser.dataLayer.filter(args=>args[0]==='event'&&args[1]==='page_view').length,1);
assert.equal(browser.dataLayer.find(args=>args[0]==='event')[2].send_to,'G-AB1234');
consent={analytics:false,personalization:false};render();
assert.equal(browser['ga-disable-G-AB1234'],true);
assert.equal(browser.dataLayer.at(-1)[2].analytics_storage,'denied');
console.log('PASS measurement: valid IDs, local-only diagnostics, category consent, one script, targeted page views and revocation');

for (const id of ['', 'G-TEST1234']) {
  const events=[];let analyticsConsent=false;
  const analytics=createTestLoader({'./cookie-consent':{readCookieConsentSettings:()=>({analytics:analyticsConsent})}},
    {process:{env:{NEXT_PUBLIC_GA_MEASUREMENT_ID:id}},window:{location:{origin:'https://maskines.com',pathname:'/en/messages/private-id'},gtag:(...args)=>events.push(args)}})('lib/analytics.ts');
  assert.equal(analytics.trackAnalyticsEvent('search'),false);
  analyticsConsent=true;
  assert.equal(analytics.trackAnalyticsEvent('search',{send_to:'AW-123456'}),Boolean(id));
  if (id) {
    assert.equal(events[0][2].send_to,id);
    assert.equal(events[0][2].page_path,'/en/messages');
  } else assert.equal(events.length,0);
}
console.log('PASS analytics: no event without GA destination/consent; explicit GA target cannot be overridden with an ads ID');

const {expandSitemapLanguages}=load('lib/sitemap-locales.ts');
const urls=expandSitemapLanguages([
  {url:'https://maskines.com/a',alternates:{languages:{fi:'https://maskines.com/a',en:'https://maskines.com/en/a',sv:'https://maskines.com/sv/a'}}},
  {url:'https://maskines.com/b',alternates:{languages:{fi:'https://maskines.com/b',en:'https://maskines.com/en/b',sv:'https://maskines.com/sv/a'}}}
]);
assert.equal(urls.length,5);
assert.equal(new Set(urls.map(row=>row.url)).size,urls.length);
for (const entry of urls) {
  for (const url of Object.values(entry.alternates.languages)) {
    assert.deepEqual(urls.find(row=>row.url===url).alternates,entry.alternates);
  }
}
const home=source('app/HomeClient.tsx');
assert.ok(home.includes('listingMatchesQuery({ ...listing, category: "", subcategory: "", location: "" }, appliedQuery)'),'Legacy result filtering retains the same translated aliases as the database');
assert.match(home,/INITIAL_LISTING_FETCH_LIMIT = 24/);
assert.match(home,/if \(!DATABASE_LISTING_FILTERS_ENABLED \|\| !filterPanelVisible\) return/);
assert.match(home,/initialUsesDatabaseFilters/);
assert.match(home,/priority=\{listingIndex < 2\}/);
assert.match(source('app/page.tsx'),/initialCount=\{initialResult.count/);
assert.match(source('lib/supabase.ts'),/listingProjection\(columns, sortColumn/);
console.log('PASS search/performance/SEO: reciprocal collision-safe sitemap, bounded feed, SSR reuse, closed-panel count guard and first-image priority');
