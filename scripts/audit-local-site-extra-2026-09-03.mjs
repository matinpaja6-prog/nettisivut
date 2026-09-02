import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const out=new URL('../output/site-audit-2026-09-03/',import.meta.url);
const report=JSON.parse(await readFile(new URL('audit.json',out),'utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960}});
await context.route('**/*',route=>{
 const q=route.request(),u=new URL(q.url());
 if(/google-analytics|googletagmanager/.test(u.hostname))return route.abort();
 if(!['GET','HEAD','OPTIONS'].includes(q.method()) && u.pathname!=='/rest/v1/rpc/maskines_search_listings')return route.abort();
 return route.continue();
});
const page=await context.newPage();page.setDefaultTimeout(20000);
try {
 await page.goto('http://localhost:3000/evasteet');
 await page.waitForFunction(()=>document.documentElement.dataset.maskinesMeasurement);
 await page.getByRole('button',{name:'Vain välttämättömät',exact:true}).click();
 await page.getByRole('button',{name:'Väriteema',exact:true}).click();
 await page.getByRole('option',{name:'Vaalea',exact:true}).click();
 for(const [name,path,width,height] of [['seller','/profiili/arcticparts',1440,960],['create-guest','/myy',390,844]]) {
   await page.setViewportSize({width,height});await page.goto('http://localhost:3000'+path);
   await page.locator('main h1').first().waitFor();
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:fileURLToPath(new URL(name+'.png',out))});
   const info=await page.evaluate(()=>({url:location.pathname+location.search,h1:[...document.querySelectorAll('h1')].map(e=>e.textContent.trim()),mainText:document.querySelector('main')?.innerText.slice(0,6000),pageWidth:document.documentElement.scrollWidth}));
   Object.assign(report.pages.find(p=>p.name===name),info,{refreshedAfterContentReady:true});
   console.log(JSON.stringify({name,...info,mainText:info.mainText?.slice(0,700)}));
 }
 await page.goto('http://localhost:3000/?q=lynx');
 await page.locator('[data-listing-card]').first().waitFor();
 await page.getByRole('button',{name:'Muokkaa suodatusta',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>/^Hae \(\d+\)/.test(b.textContent.trim())),{},{timeout:12000}).catch(()=>{});
 await page.screenshot({path:fileURLToPath(new URL('filters-mobile.png',out))});
 report.filterText=(await page.locator('body').innerText()).slice(0,12000);
} finally {await context.close();await browser.close();}
report.productionLocale=[];
for(const host of ['http://127.0.0.1:3100','http://localhost:3100']) {
 for(const path of ['/no','/sv','/en','/en/parts/lynx']) {
  try {
   const r=await fetch(host+path,{headers:{'user-agent':'Googlebot'},signal:AbortSignal.timeout(15000)}),html=await r.text();
   const row={host,path,url:r.url,status:r.status,lang:html.match(/<html[^>]*lang="([^"]+)"/)?.[1],title:html.match(/<title>(.*?)<\/title>/)?.[1],canonical:html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1]};
   report.productionLocale.push(row);console.log(JSON.stringify(row));
  } catch(e) {report.productionLocale.push({host,path,error:e.message});}
 }
}
const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
report.createButtonContrast={foreground:'#ffffff',gradient:['#ff841f','#ff6810'],ratios:[[255,132,31],[255,104,16]].map(c=>Number((1.05/(luminance(c)+.05)).toFixed(2))),fontPx:14,fontWeight:900,method:'Computed CSS colors and WCAG relative luminance; gradient endpoint checks. Both endpoints below the 4.5:1 threshold for this text size.'};
await writeFile(new URL('audit.json',out),JSON.stringify(report,null,2));
console.log(JSON.stringify(report.createButtonContrast));
