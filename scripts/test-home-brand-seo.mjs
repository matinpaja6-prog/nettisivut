import assert from 'node:assert/strict';
import * as jsx from 'react/jsx-runtime';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { createTestLoader } from './test-module-loader.mjs';
let locale='fi';
const load=createTestLoader({
  'react/jsx-runtime':jsx,
  '@/app/HomeClient':{default:()=>null},
  './HomeClient':{default:()=>null},
  '@/lib/server-locale':{getServerLocale:async()=>locale},
  '@/lib/supabase':{getListings:async()=>({data:[],count:0})},
  '@/lib/routes':{
    listingPath:()=>'/ilmoitukset/1',
    languagePaths:()=>({'fi-FI':'/',en:'/en',sv:'/sv',nb:'/no'}),
    translateLocalizedPath:(_path,language)=>language==='fi'?'/':'/'+language
  }
}, {process:{env:{NODE_ENV:'production',NEXT_PUBLIC_SITE_URL:'https://maskines.com'}}});
const home=load('app/page.tsx');
const {siteBrandImage,siteFavicon}=load('lib/site-brand-image.ts');
const image=await sharp(fileURLToPath(new URL('../public'+siteBrandImage.url,import.meta.url))).metadata();
assert.equal(image.width,siteBrandImage.width);assert.equal(image.height,siteBrandImage.height);
assert.equal(siteFavicon,'/maskines-favicon-v6.png');
for (locale of ['fi','en','sv','no']) {
  const meta=await home.generateMetadata();
  assert.ok(meta.title.absolute.startsWith('Maskines – '));
  assert.equal(meta.openGraph.images[0].url,siteBrandImage.url,'Explicit homepage image survives Next metadata replacement');
  assert.deepEqual(meta.twitter.images,[siteBrandImage.url]);
  const page=await home.default({searchParams:Promise.resolve({})});
  const graph=JSON.parse(page.props.children[0].props.dangerouslySetInnerHTML.__html)['@graph'];
  const webpage=graph.find(row=>row['@type']==='WebPage');
  const organization=graph.find(row=>row['@type']==='Organization');
  assert.equal(webpage.name,meta.title.absolute);
  assert.equal(webpage.primaryImageOfPage.url,'https://maskines.com'+siteBrandImage.url);
  assert.deepEqual(organization.logo,webpage.primaryImageOfPage);
  assert.equal(webpage.url,meta.alternates.canonical);
}
console.log('PASS homepage brand: current logo, real image dimensions, explicit OG/Twitter, localized titles and primaryImageOfPage');
