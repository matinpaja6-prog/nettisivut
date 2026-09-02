// Bounded, signed-out audit. No purchases, messages, account or database writes.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const base=new URL('http://localhost:3000');
const out=new URL('../output/site-audit-2026-09-03/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960},locale:'fi-FI'});
let blockedWrites=0;
await context.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if (/google-analytics|googletagmanager/.test(url.hostname)) return route.abort();
  const readSearch=url.hostname.endsWith('.supabase.co') && url.pathname==='/rest/v1/rpc/maskines_search_listings';
  if (!['GET','HEAD','OPTIONS'].includes(req.method()) && !readSearch && (url.origin===base.origin || url.hostname.endsWith('.supabase.co'))) {blockedWrites++;return route.abort();}
  return route.continue();
});
const page=await context.newPage();
page.setDefaultTimeout(15000);
const errors=[];
page.on('pageerror',e=>errors.push({path:new URL(page.url()).pathname,message:e.message.slice(0,300)}));
const report={generatedAt:new Date().toISOString(),base:base.href,method:'Signed-out installed Chrome; localhost development UI. Analytics blocked; only read-only search POST allowed. Screenshots are current, not production proof.',pages:[],seo:[],errors};
async function navigate(path) {
  const response=await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.documentElement.dataset.maskinesMeasurement,{},{timeout:25000});
  await page.locator('main').first().waitFor({timeout:20000});
  if (/^\/(en|sv|no)?$/.test(new URL(page.url()).pathname)) {
    await page.waitForFunction(()=>document.querySelector('[data-listing-card]') || /Ei ilmoituksia näytettäväksi|No listings to show|Inga annonser att visa|Ingen annonser å vise/.test(document.querySelector('main')?.textContent || ''),{},{timeout:30000});
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.race([Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;}).map(i=>i.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,2500))]);});
  return response;
}
async function snapshot(name,path,options={}) {
  if (options.width) await page.setViewportSize({width:options.width,height:options.height || 844});
  const response=await navigate(path);
  await page.screenshot({path:fileURLToPath(new URL(name+'.png',out))});
  const info=await page.evaluate(()=>{
    const visible=e=>!!(e.getClientRects().length && getComputedStyle(e).visibility!=='hidden');
    const text=e=>(e?.textContent||'').trim().replace(/\s+/g,' ');
    const controls=[...document.querySelectorAll('button,a,input,select,textarea')].filter(visible);
    const nameless=controls.filter(e=>!text(e)&&!e.getAttribute('aria-label')&&!e.getAttribute('title')&&!e.getAttribute('placeholder')&&!e.querySelector('img[alt]')&&!e.labels?.length).map(e=>({tag:e.tagName,cls:String(e.className).slice(0,100)}));
    const small=controls.map(e=>({name:(text(e)||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,70),tag:e.tagName,rect:e.getBoundingClientRect()})).filter(e=>e.rect.width<24||e.rect.height<24).slice(0,25).map(e=>({...e,rect:{w:e.rect.width,h:e.rect.height}}));
    const samples=controls.filter(e=>e.tagName==='BUTTON'||e.className?.toString().includes('create')).slice(0,40).map(e=>{const s=getComputedStyle(e);return {name:(text(e)||e.getAttribute('aria-label')||'').slice(0,60),color:s.color,background:s.backgroundColor,font:s.fontSize,weight:s.fontWeight};});
    const details=[...document.querySelectorAll('.desktop-listing-title-facts dd')].map(text);
    return {url:location.pathname+location.search,title:document.title,lang:document.documentElement.lang,theme:document.documentElement.dataset.theme,viewport:[innerWidth,innerHeight],pageWidth:document.documentElement.scrollWidth,h1:[...document.querySelectorAll('h1')].map(text),headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0,18).map(text),mainText:text(document.querySelector('main')).slice(0,6000),images:{count:document.images.length,missingAlt:[...document.images].filter(i=>!i.hasAttribute('alt')).length,broken:[...document.images].filter(i=>visible(i)&&i.complete&&!i.naturalWidth).length},nameless,smallTargets:small,controlColors:samples,titleFacts:details,measurement:document.documentElement.dataset.maskinesMeasurement,links:[...document.querySelectorAll('main a[href]')].slice(0,35).map(e=>({text:text(e).slice(0,80),href:e.getAttribute('href')}))};
  });
  report.pages.push({name,status:response?.status(),...info});
  console.log(JSON.stringify({name,status:response?.status(),url:info.url,h1:info.h1,width:info.viewport[0],pageWidth:info.pageWidth,images:info.images,nameless:info.nameless.length,titleFacts:info.titleFacts}));
}
try {
  await navigate('/evasteet');
  await page.getByRole('button',{name:'Vain välttämättömät',exact:true}).click();
  await page.getByRole('button',{name:'Väriteema',exact:true}).click();
  await page.getByRole('option',{name:'Vaalea',exact:true}).click();
  await snapshot('home-desktop','/',{width:1440,height:960});
  await snapshot('home-mobile','/',{width:390,height:844});
  await snapshot('home-small','/',{width:320,height:740});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Väriteema',exact:true}).click();
  await page.getByRole('option',{name:'Tumma',exact:true}).click();
  await snapshot('home-mobile-dark','/');
  await page.getByRole('button',{name:'Väriteema',exact:true}).click();
  await page.getByRole('option',{name:'Vaalea',exact:true}).click();
  await snapshot('search-mobile','/?q=lynx');
  await page.getByRole('button',{name:'Muokkaa suodatusta',exact:true}).click();
  await page.screenshot({path:fileURLToPath(new URL('filters-mobile.png',out))});
  report.filterText=await page.locator('body').innerText();
  await snapshot('search-empty','/?q=maskinesolemattomattestiosat20260903');
  await snapshot('home-english','/en',{width:1440,height:960});
  await snapshot('collection','/varaosat/lynx');
  await snapshot('vehicle','/polaris/rmk/128');
  await snapshot('part','/ski-doo/mxz-rs/polttoainesailiot-tankit/165');
  await page.getByRole('button',{name:'Avaa kuva suurempana',exact:true}).first().click();
  await page.locator('[data-listing-image-preview] img').evaluate(i=>i.decode());
  await page.screenshot({path:fileURLToPath(new URL('image-preview.png',out))});
  report.imagePreview=await page.locator('[data-listing-image-preview]').evaluate(d=>({modal:d.matches(':modal'),background:getComputedStyle(d).backgroundColor,rect:d.getBoundingClientRect().toJSON()}));
  await page.keyboard.press('Escape');
  await snapshot('seller','/profiili/arcticparts');
  await snapshot('create-guest','/myy',{width:390,height:844});
  await snapshot('login','/kirjaudu');
  await snapshot('cart-empty','/ostoskori');
  for (const path of ['/','/en','/sv','/no','/varaosat/lynx','/en/parts/lynx','/sv/reservdelar/lynx','/no/reservedeler/lynx','/polaris/rmk/128','/kirjaudu','/varaosat/yamaha/dt/kaasuttimet','/varaosat/ei-ole-olemassa-testimerkki','/en/parts/ei-ole-olemassa-testimerkki','/sitemap.xml','/robots.txt']) {
    const r=await fetch(new URL(path,base),{headers:{'user-agent':'Googlebot'},signal:AbortSignal.timeout(30000)}),html=await r.text();
    report.seo.push({path,status:r.status,canonical:html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1],title:html.match(/<title>([\s\S]*?)<\/title>/)?.[1],description:html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/)?.[1],robots:html.match(/<meta[^>]*name="robots"[^>]*content="([^"]+)"/)?.[1],h1Count:(html.match(/<h1(?:\s|>)/g)||[]).length,languages:[...html.matchAll(/href[Ll]ang="([^"]+)"/g)].map(m=>m[1]),jsonTypes:[...html.matchAll(/"@type":"([^"]+)"/g)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i),sitemapUrls:path==='/sitemap.xml'?(html.match(/<loc>/g)||[]).length:undefined,robotsText:path==='/robots.txt'?html:undefined});
  }
  report.blockedWrites=blockedWrites;
  assert.ok(report.pages.length>=10);
  await writeFile(new URL('audit.json',out),JSON.stringify(report,null,2));
} finally {await writeFile(new URL('audit.json',out),JSON.stringify(report,null,2));await context.close();await browser.close();}
