import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTestLoader} from './test-module-loader.mjs';
import * as jsxRuntime from 'react/jsx-runtime';
import './test-listing-title-facts.mjs';
const load=createTestLoader();
const {listingProjection,NUMERIC_PRICE_FIELD}=load('lib/listing-query-shape.ts');
assert.equal(listingProjection(['id','price'],NUMERIC_PRICE_FIELD,true),'id,price,maskines_price_numeric');
assert.equal(listingProjection(['id',NUMERIC_PRICE_FIELD],NUMERIC_PRICE_FIELD,true),'id,maskines_price_numeric');
assert.equal(listingProjection(['id','price'],'created_at',true),'id,price');
assert.equal(listingProjection(['id','price'],NUMERIC_PRICE_FIELD,false),'id,price');
const {listingFilterChips,removeListingFilter}=load('lib/listing-filter-chips.ts');
const defaults={query:'',category:'',subcategory:'',selectedBrand:'Kaikki',modelQuery:'',garageFilterId:'',minPrice:0,maxPrice:100000};
assert.equal(listingFilterChips(defaults,'fi').length,0);
const selected={...defaults,query:'carburetor',selectedBrand:'Yamaha',modelQuery:'DT',garageFilterId:'vehicle-1',minPrice:20,maxPrice:80,vehicleColorsQuery:['Musta'],vehicleVatDeductibleQuery:true};
const before=structuredClone(selected);
for(const locale of ['fi','en','sv','no']) {
  const chips=listingFilterChips(selected,locale);
  assert.equal(chips.length,7);
  assert.ok(chips.every(chip=>chip.label));
  assert.equal(chips.find(chip=>chip.id==='price').value,'20–80 €');
  assert.ok(!chips.find(chip=>chip.id==='garage').value,'No opaque garage UUID in the label');
}
assert.equal(removeListingFilter(selected,'brand').modelQuery,'');
assert.equal(removeListingFilter(selected,'brand').garageFilterId,'');
assert.equal(removeListingFilter(selected,'brand').selectedBrand,'Kaikki');
assert.equal(removeListingFilter(selected,'price').maxPrice,100000);
assert.equal(removeListingFilter(selected,'price').minPrice,0);
assert.deepEqual(removeListingFilter(selected,'colors').vehicleColorsQuery,[]);
assert.equal(removeListingFilter(selected,'vat').vehicleVatDeductibleQuery,false);
assert.equal(removeListingFilter(selected,'query').query,'');
assert.equal(removeListingFilter(selected,'unknown'),selected);
assert.deepEqual(selected,before,'Removing a chip does not mutate applied state');
const location='location:v1:'+JSON.stringify({countries:['SE'],regions:[],municipalities:['SE|Kiruna']});
assert.equal(listingFilterChips({...defaults,locationQuery:location},'en')[0].value,'Sweden / Kiruna');
const copy=load('lib/listing-quality-copy.ts').listingQualityCopy;
for (const locale of ['fi','en','sv','no']) assert.ok(Object.values(copy[locale]).every(Boolean));
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
assert.doesNotMatch(source('app/HomeClient.tsx'),/marketplace-quick-price/,'User-requested removal of the standalone quick price-range box');
assert.doesNotMatch(source('app/styles/marketplace-improvements.css'),/marketplace-quick-price/,'Removed quick price-range styles must not remain');
assert.doesNotMatch(source('app/listing/[id]/ListingPageClient.tsx'),/listing-purchase-summary|listing-summary-mobile|listing-summary-desktop/,'User-requested removal of the extra facts/contact box');
assert.match(source('app/listing/[id]/ListingPageClient.tsx'),/label: ui.condition/,'Existing basic information remains');
assert.match(source('app/components/DeferredAccountTools.tsx'),/signedIn && <RequiredReviewGate/);
assert.match(source('app/components/DeferredAccountTools.tsx'),/dynamic\(\(\) => import\("\.\/FloatingChat"\)/);
assert.doesNotMatch(source('app/layout.tsx'),/import FloatingChat/);
assert.match(source('app/components/FloatingChat.tsx'),/else \{\s*setOpen\(initialOpen\)/,'Guest auth initialization preserves the first requested opening');
assert.equal((source('app/components/UniversalTopbar.tsx').match(/<CreateListingAction \/>/g)||[]).length,2,'Guest and signed-in headers use the exact same create action');
assert.match(source('app/components/CreateListingAction.tsx'),/universal-create-plus/);
// Deferred account controls: guest, first use, sign-in, sign-out, stale async check.
const state=[];let cursor=0,effects=[],authCallback,resolveSession,cleaned=false,dynamicIndex=0;
const sessionPromise=new Promise(resolve=>{resolveSession=resolve;});
const accountTools=createTestLoader({
  'react/jsx-runtime':jsxRuntime,
  react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=value;}];},useEffect:effect=>effects.push(effect)},
  'next/dynamic':{default:()=>`LazyAccountTool${dynamicIndex++}`},
  'lucide-react':{MessageCircle:'svg'},
  '@/lib/supabase':{getSafeAuthSession:()=>sessionPromise,supabase:{auth:{onAuthStateChange(callback){authCallback=callback;return {data:{subscription:{unsubscribe(){cleaned=true;}}}};}}}},
  '@/lib/navigation':{usePathname:()=>'/en'},
  '@/lib/routes':{canonicalPathFromLocalized:()=> '/'},
  '@/lib/i18n':{useLanguage:()=>({t:{messages:'Messages'}})}
})('app/components/DeferredAccountTools.tsx').default;
function renderTools(){cursor=0;effects=[];return accountTools().props.children;}
let rendered=renderTools();
assert.equal(rendered[0],false);assert.equal(rendered[1].type,'button');
const cleanup=effects[0]();
rendered[1].props.onClick();rendered=renderTools();
assert.equal(rendered[1].type,'LazyAccountTool0');assert.equal(rendered[1].props.initialOpen,true);
authCallback('SIGNED_IN',{user:{id:'test-user'}});rendered=renderTools();
assert.equal(rendered[0].type,'LazyAccountTool1');assert.equal(rendered[1].type,'LazyAccountTool0');
resolveSession(null);await sessionPromise;await Promise.resolve();
assert.equal(renderTools()[0].type,'LazyAccountTool1','Late initial session must not overwrite a newer sign-in');
authCallback('SIGNED_OUT',null);rendered=renderTools();
assert.equal(rendered[0],false);assert.equal(rendered[1].type,'button');
cleanup();assert.equal(cleaned,true);
console.log('PASS report fixes: projected numeric RPC, removable filters/dependencies, four-language quality guidance and deferred account UI');
