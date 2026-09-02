import assert from 'node:assert/strict';
const base=new URL(process.env.MASKINES_TEST_URL || 'http://localhost:3100');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname),'Local test server only');
const decode=s=>s.replaceAll('&amp;','&');
async function page(path) {
  const response=await fetch(new URL(path,base),{headers:{'user-agent':'Googlebot'},signal:AbortSignal.timeout(30000)});
  const html=await response.text();
  const canonical=html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  const robots=html.match(/<meta[^>]*name="robots"[^>]*content="([^"]+)"/)?.[1] || '';
  const json=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m=>{const v=JSON.parse(m[1]);return v['@graph']||[v];});
  return {response,html,canonical,robots,json};
}
for(const [path,lang] of [['/varaosat/lynx','fi'],['/en/parts/lynx','en'],['/sv/reservdelar/lynx','sv'],['/no/reservedeler/lynx','nb']]) {
  const p=await page(path);
  assert.equal(p.response.status,200,path);
  assert.equal(new URL(p.canonical).pathname,path);
  assert.ok(!p.robots.includes('noindex'),path);
  assert.ok(p.html.includes(`lang="${lang}"`));
  assert.equal((p.html.match(/<h1(?:\s|>)/g)||[]).length,1);
  const collection=p.json.find(v=>v['@type']==='CollectionPage');
  assert.ok(collection.mainEntity.numberOfItems>=3);
  assert.equal(collection.mainEntity.numberOfItems,collection.mainEntity.itemListElement.length);
  for(const item of collection.mainEntity.itemListElement) assert.ok(p.html.includes(`href="${new URL(item.url).pathname}"`),'JSON-LD item is a visible navigable card');
  for(const language of ['fi-FI','en','sv','nb']) assert.match(p.html,new RegExp(`href[Ll]ang="${language}"`));
  console.log(`PASS collection ${path}: localized SSR heading, canonical, hreflang and ${collection.mainEntity.numberOfItems} matching cards`);
}
const thin=await page('/varaosat/yamaha/dt/kaasuttimet');
assert.equal(thin.response.status,200);assert.match(thin.robots,/noindex/);
const duplicate=await page('/varaosat/yamaha/dt');
assert.equal(duplicate.response.status,200);
assert.equal(new URL(duplicate.canonical).pathname,'/varaosat/yamaha');
assert.ok(!duplicate.robots.includes('noindex'));
for(const root of ['/varaosat','/en/parts','/sv/reservdelar','/no/reservedeler']) {
  const missing=await page(root+'/definitely-not-a-maskines-collection');
  assert.equal(missing.response.status,404,root);assert.match(missing.robots,/noindex/);
}
const browserMissing=await fetch(new URL('/varaosat/definitely-not-a-maskines-collection',base),{headers:{'user-agent':'Mozilla/5.0'},signal:AbortSignal.timeout(30000)});
assert.equal(browserMissing.status,404,'A real HTTP 404 for browsers too, before the root loading boundary');
const engines=await page('/varaosat/moottori');
assert.equal(engines.response.status,200);
assert.ok(engines.json.find(v=>v['@type']==='CollectionPage').mainEntity.numberOfItems<40,'Engine no longer matches every snowmobile part');
const xml=await (await fetch(new URL('/sitemap.xml',base),{signal:AbortSignal.timeout(30000)})).text();
const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>decode(m[1]));
assert.equal(new Set(urls).size,urls.length);
const paths=new Set(urls.map(url=>new URL(url).pathname));
assert.ok(paths.has('/varaosat/lynx'));
assert.ok(!paths.has('/varaosat/yamaha/dt'));
assert.ok(!paths.has('/varaosat/yamaha/dt/kaasuttimet'));
assert.ok(urls.every(url=>new URL(url).origin===new URL(engines.canonical).origin),'Sitemap and page canonicals use the same configured site origin');
console.log(`PASS thin/duplicate/missing collections, exact engine intent and sitemap (${urls.length} unique URLs)`);
