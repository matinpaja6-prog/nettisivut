import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createTestLoader} from './test-module-loader.mjs';
const require=createRequire(import.meta.url);
const load=createTestLoader({'lucide-react':require('lucide-react')});
const seo=load('lib/seo-search.ts');
const policy=load('lib/seo-collection-policy.ts');
for(const path of ['/', '/en', '/varaosat', '/varaosat/', '/auth', '/profile', '/ajoneuvot/a/b', '/api/commerce/checkout']) assert.equal(policy.parseSeoCollectionRoute(path),undefined);
assert.deepEqual(policy.parseSeoCollectionRoute('/en/parts/lynx/rave'),{segments:['lynx','rave'],kind:'parts',locale:'en'});
assert.deepEqual(policy.parseSeoCollectionRoute('/no/kjoretoy/lynx'),{segments:['lynx'],kind:'vehicles',locale:'no'});
const base={title:'Kokonainen moottori',description:'Testaamaton',brand:'Lynx',model:'Rave RS',year:'2021',vehicle_type:'Moottorikelkka',category:'Varaosat',subcategory:'Kokonainen moottori',is_hidden:false,is_sold:false,created_at:'2026-09-01T00:00:00Z'};
const rows=Array.from({length:4},(_,i)=>({...base,id:'engine-'+i}));
rows.push({...base,id:'frame',title:'Runko',subcategory:'Runko',description:''});
rows.push({...base,id:'hidden',is_hidden:true},{...base,id:'sold',is_sold:true});
assert.equal(seo.listingMatchesSeoCollection(rows[4],'moottori','parts'),false,'Engine is not a substring match on snowmobile');
assert.equal(seo.listingMatchesSeoCollection(rows[0],'lynx rave rs','parts'),true);
const catalog=policy.buildSeoCollectionCatalog([...rows,rows[0]]);
const engines=catalog.find(row=>row.path==='/varaosat/kokonainen-moottori');
assert.equal(engines.matches.length,4,'Unique, public, unsold matches only');
const small=catalog.find(row=>row.path==='/varaosat/runko');
assert.equal(small.reason,'small-inventory');
const duplicate=catalog.find(row=>row.reason==='duplicate-results');
assert.ok(duplicate);
assert.deepEqual(policy.buildSeoCollectionCatalog([...rows].reverse()).map(({path,canonicalPath,reason,matches})=>({path,canonicalPath,reason,count:matches.length})),catalog.map(({path,canonicalPath,reason,matches})=>({path,canonicalPath,reason,count:matches.length})),'Stable canonical owner independent of input order');
for(const locale of ['fi','en','sv','no']) {
  const path=seo.seoLocalizedCollectionDescriptorPath('parts',engines.path,locale);
  assert.equal(policy.findSeoCollection(catalog,path,locale).path,engines.path);
  assert.equal(policy.collectionIndexing(small,catalog,locale).index,false);
  const d=policy.collectionIndexing(duplicate,catalog,locale);
  assert.equal(d.index,true,'Duplicate consolidated by canonical, not contradictory noindex');
  assert.equal(d.languages,undefined);
  assert.notEqual(d.canonicalPath,seo.seoLocalizedCollectionDescriptorPath(duplicate.kind,duplicate.path,locale));
}
assert.equal(policy.findSeoCollection(catalog,'/varaosat/%invalid'),undefined);
const collisions=[...catalog.filter(row=>row.indexable),
  {kind:'parts',query:'iskarit',path:'/varaosat/iskarit',matches:rows.slice(0,3),canonicalPath:'/varaosat/iskarit',indexable:true,reason:'indexable'},
  {kind:'parts',query:'iskunvaimentimet',path:'/varaosat/iskunvaimentimet',matches:rows.slice(0,4),canonicalPath:'/varaosat/iskunvaimentimet',indexable:true,reason:'indexable'}];
const seen=new Map();
for(const entry of collisions) for(const [language,path] of Object.entries(policy.indexCollectionLanguages(entry,collisions))) {
  if(language==='x-default')continue;
  assert.ok(!seen.has(path),'Translated URL has exactly one owner');seen.set(path,entry.path);
  const locale=language==='fi-FI'?'fi':language==='nb'?'no':language;
  assert.equal(policy.findSeoCollection(collisions,path,locale).path,entry.path,'Metadata and sitemap agree on locale owner');
}
assert.deepEqual(policy.buildSeoCollectionCatalog([]),[]);
// Model + aftermarket manufacturer + actual part type, on arbitrary makes.
for (const [brand, model, manufacturer] of [['Yamaha','DT','Voca'], ['Derbi','Senda','Yasuni'], ['Honda','CRF','FMF'], ['Testimerkki','Malli X','OmaValmistaja']]) {
  const exhaust = {...base, id:'pipe', brand, model, vehicle_type:'Mopo', category:'Pakoputkisto',
    subcategory:'Pakoputkisto / Pakoputket', title:`${manufacturer} pakoputki`, part_model:manufacturer, description:''};
  const slug=seo.seoSearchSlug;
  const path=`/varaosat/${slug(brand)}/${slug(model)}/${slug(manufacturer)}/putki`;
  const descriptor=seo.seoPartCollectionDescriptors(exhaust).find(row=>row.path===path);
  assert.ok(descriptor, path);
  assert.equal(seo.listingMatchesSeoCollection(exhaust, `${brand} ${model} ${manufacturer} putki`, 'parts'),true);
  assert.equal(seo.listingMatchesSeoCollection(exhaust, `${manufacturer} putki ${brand} ${model}`, 'parts'),true,'Word order does not create different inventory');
  assert.equal(seo.listingMatchesSeoCollection({...exhaust,subcategory:'Pakoputkisto / Pakoputken tiivisteet',title:'Tiiviste'},`${brand} ${model} putki`,'parts'),false,'An exhaust gasket is not a pipe');
  assert.equal(seo.listingMatchesSeoCollection({...exhaust,brand:'Muu',model:'Eri'},descriptor.query,'parts'),false);
  assert.equal(seo.listingMatchesSeoCollection({...exhaust,brand:'Muu',model:'Eri',description:`Ei sovi ${brand} ${model}`},descriptor.query,'parts'),false,'Do not infer compatibility from free text');
  const sparse=policy.buildSeoCollectionCatalog([exhaust]);
  assert.equal(sparse.find(row=>row.path===path).indexable,false,'One item is indexed through its listing, not dozens of thin pages');
  const stock=policy.buildSeoCollectionCatalog([0,1,2].map(i=>({...exhaust,id:'pipe-'+i})));
  const combined=stock.find(row=>row.path===path);
  assert.equal(combined.matches.length,3);
  assert.ok(stock.find(row=>row.path===combined.canonicalPath).indexable,'Duplicate aliases resolve to one indexable owner');
  for(const locale of ['fi','en','sv','no']) {
    const localized=seo.seoLocalizedCollectionDescriptorPath('parts',path,locale);
    assert.ok(policy.findSeoCollection(stock,localized,locale));
  }
  assert.equal(policy.findSeoCollection(stock,path.replace('/putki','/olematon-osa')),undefined,'No arbitrary keyword landing pages');
}
const carb={...base,id:'carb',brand:'Yamaha',model:'DT',category:'Moottori',subcategory:'Kaasuttimet',title:'Kaasutin',description:''};
assert.equal(seo.listingMatchesSeoCollection(carb,'yamaha dt kaasutin','parts'),true);
assert.equal(seo.listingMatchesSeoCollection(carb,'yamaha dt kaasuttimet','parts'),true);
assert.ok(!seo.seoPartCollectionDescriptors({...carb,description:'Ei Voca putki'}).some(row=>row.query.includes('voca')),'Do not infer a manufacturer from description mentions');
console.log('PASS make/model/manufacturer/part combinations, synonyms, word order, exact part intent and thin/duplicate guards');
console.log('PASS collection SEO: exact word matching, real counts, hidden/sold, thin pages, stable canonical sets, all locales and translated slug collisions');
