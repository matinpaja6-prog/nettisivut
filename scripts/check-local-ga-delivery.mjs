// Ephemeral, signed-out browser. No user profile, cookies or raw analytics IDs
// are saved. Google receives test events only with the explicit opt-in flag.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const base=new URL(process.env.MASKINES_TEST_URL || 'http://localhost:3000');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname),'Localhost only');
const allowGoogle=process.argv.includes('--allow-google');
const browser=await chromium.launch({headless:true,channel:process.env.MASKINES_BROWSER_CHANNEL || 'chrome'});
const context=await browser.newContext();
const page=await context.newPage();
const requests=[],responses=[],failures=[],consoleErrors=[];
const isCollect=url=>/(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/.test(new URL(url).hostname) && new URL(url).pathname.includes('collect');
function summaries(request) {
  const url=new URL(request.url());
  // GA can batch several newline-separated events in one POST request.
  return (request.postData() || '').split('\n').map(line=>{
    const params=new URLSearchParams(url.search),body=new URLSearchParams(line);
    return {host:url.hostname,path:url.pathname,event:body.get('en') || params.get('en'),measurementId:params.get('tid') || body.get('tid'),debug:Object.fromEntries([...params,...body].filter(([key])=>/debug|_dbg/.test(key))),consent:params.get('gcs')};
  });
}
await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(isCollect(url.href) && !allowGoogle) return route.fulfill({status:204,body:''});
  // Prevent application/database writes even if a view counter is added later.
  if(!['GET','HEAD','OPTIONS'].includes(request.method()) && (url.origin===base.origin || url.hostname.endsWith('.supabase.co'))) return route.abort();
  return route.continue();
});
page.on('request',request=>{if(isCollect(request.url()))requests.push(...summaries(request));});
page.on('response',response=>{if(isCollect(response.url()))responses.push(...summaries(response.request()).map(event=>({...event,status:response.status()})));});
page.on('requestfailed',request=>{
  const url=new URL(request.url());
  if(/google/.test(url.hostname))failures.push({host:url.hostname,path:url.pathname,error:request.failure()?.errorText});
});
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text().replace(/https?:\/\/[^\s"']+/g,value=>{try {const u=new URL(value);return u.origin+u.pathname;}catch{return '[url]';}}).slice(0,550));});
try {
  await page.goto(new URL('/evasteet',base).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.maskinesMeasurement);
  const before={requests:requests.length,googleScripts:await page.locator('script[src*="googletagmanager"]').count()};
  assert.equal(before.requests,0);assert.equal(before.googleScripts,0);
  const firstResponsePromise=page.waitForResponse(response=>isCollect(response.url()),{timeout:20000});
  await page.getByRole('button',{name:'Kaikki evästeet',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.maskinesMeasurement || '{}').analyticsConsent===true);
  const firstResponse=await firstResponsePromise;
  const probeResponsePromise=page.waitForResponse(response=>isCollect(response.url()) && summaries(response.request()).some(event=>event.event==='maskines_debug_check'),{timeout:20000});
  await page.evaluate(()=>{
    const tag=document.querySelector('script[data-maskines-google-tag]');
    const id=tag && new URL(tag.src).searchParams.get('id');
    if (!id?.startsWith('G-') || !JSON.parse(document.documentElement.dataset.maskinesMeasurement || '{}').analyticsConsent) throw new Error('GA ID and consent required');
    window.gtag('event','maskines_debug_check',{send_to:id,debug_mode:true});
  });
  const probeResponse=await probeResponsePromise;
  const diagnostics=await page.evaluate(()=>({measurement:JSON.parse(document.documentElement.dataset.maskinesMeasurement || '{}'),commands:(window.dataLayer || []).filter(v=>v && typeof v[0]==='string').slice(0,12).map(v=>({type:Object.prototype.toString.call(v),command:v[0],event:v[0]==='event'?v[1]:undefined,debug:v[2]?.debug_mode})),gaDisabled:window['ga-disable-G-BN07FPKVXJ']}));
  assert.ok(probeResponse.ok(),'Google transport response must be successful');
  console.log(JSON.stringify({mode:allowGoogle?'real-google-test-traffic':'intercepted-no-google-delivery',before,receivedHttpResponse:Boolean(firstResponse),requests,responses,failures,consoleErrors,diagnostics,note:'An HTTP response verifies transport, NOT processing in the Analytics account. Confirm maskines_debug_check in DebugView separately.'},null,2));
} finally { await context.close();await browser.close(); }
