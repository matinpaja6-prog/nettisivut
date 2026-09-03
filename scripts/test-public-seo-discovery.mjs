// Bounded GET-only verification; never submits indexing requests or DB writes.
import assert from 'node:assert/strict';
const base=new URL(process.env.MASKINES_TEST_URL || 'http://localhost:3000');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname) ||
  (base.origin==='https://maskines.com' && process.argv.includes('--remote-read-only')));
async function page(path) {
  const response=await fetch(new URL(path,base),{headers:{'user-agent':'Googlebot'},signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,path);
  return response.text();
}
const logo='/maskines-brand-mark-clean-v4.png';
for(const path of ['/','/en','/sv','/no']) {
  const html=await page(path);
  assert.match(html,/<title>Maskines – [^<]+<\/title>/);
  for(const attribute of ['property="og:image"','name="twitter:image"']) {
    const meta=html.match(new RegExp(`<meta[^>]*${attribute}[^>]*content="([^"]+)"`));
    assert.ok(meta,attribute);assert.equal(new URL(meta[1]).pathname,logo);
  }
  const graphs=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap(m=>{const value=JSON.parse(m[1]);return value['@graph'] || [value];});
  const home=graphs.find(row=>row['@type']==='WebPage');
  const organization=graphs.find(row=>row['@type']==='Organization');
  assert.equal(new URL(home.primaryImageOfPage.url).pathname,logo);
  assert.equal(new URL(organization.logo.url).pathname,logo);
  assert.match(html,/<link[^>]*rel="icon"[^>]*href="\/maskines-favicon-v6.png"/);
  console.log(`PASS ${path}: current logo, full title, favicon and primary page image`);
}
const sitemap=await page('/sitemap.xml');
const urls=new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname));
for(const root of ['/varaosat','/en/parts','/sv/reservdelar','/no/reservedeler']) {
  const html=await page(root);
  const directory=html.match(/<nav[^>]*data-seo-directory="parts"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(directory,'Crawlable directory in server HTML');
  const paths=[...directory.matchAll(/href="([^"]+)"/g)].map(m=>new URL(m[1],base).pathname);
  assert.ok(paths.length>0);
  for(const path of paths) assert.ok(urls.has(path),'Directory links only sitemap/canonical pages: '+path);
  for(const path of urls) if(path.startsWith(root+'/')) assert.ok(paths.includes(path),'No published collection orphaned from its department: '+path);
  console.log(`PASS ${root}: ${paths.length} server-rendered canonical category links`);
}
const pipe=await page('/varaosat/yamaha/dt/voca/putki');
assert.match(pipe,/<h1[^>]*>Yamaha DT Voca Putki/);
assert.match(pipe,/Voca Cross Carbon/);
assert.match(pipe,/<meta[^>]*name="robots"[^>]*content="noindex, follow"/,'Sparse page stays out of index; its individual listing remains indexable');
console.log('PASS real Yamaha DT Voca exhaust combination: correct inventory and sparse-page protection');
const listing=await page('/yamaha/dt/taydellinen-pakoputkisto-pakoputki-ja-aanenvaimennin/140');
assert.match(listing,/<title>Yamaha DT 2013 Voca Cross Carbon/,'Model and actual product name precede long taxonomy');
assert.match(listing,/<meta[^>]*name="robots"[^>]*content="index, follow"/);
console.log('PASS individual Voca listing: indexable with product name near start of title');
