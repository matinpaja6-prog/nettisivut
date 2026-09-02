import assert from 'node:assert/strict';
import {createTestLoader} from './test-module-loader.mjs';
for(const scenario of ['denied','revoked-during-auth','unmounted-during-auth','allowed','localhost']) {
  let consent=scenario!=='denied', effect, resolveSession;
  const calls=[];
  const session=new Promise(resolve=>{resolveSession=resolve;});
  const tracker=createTestLoader({
    react:{useEffect:callback=>{effect=callback;}},
    '@/lib/navigation':{usePathname:()=>'/en'},
    '@/lib/supabase':{supabase:{auth:{getSession:()=>session}}},
    '@/lib/cookie-consent':{COOKIE_CONSENT_EVENT:'consent',readCookieConsentSettings:()=>({analytics:consent})}
  },{window:{location:{hostname:scenario==='localhost'?'localhost':'maskines.com'},addEventListener(){},removeEventListener(){}},navigator:{userAgent:'isolated-fixture'},fetch:async(...args)=>{calls.push(args);return {};}})('app/components/SiteVisitTracker.tsx').default;
  tracker(); const cleanup=effect();
  if(scenario==='revoked-during-auth')consent=false;
  if(scenario==='unmounted-during-auth')cleanup();
  resolveSession({data:{session:null}});await session;await Promise.resolve();
  assert.equal(calls.length,scenario==='allowed'?1:0,scenario);
  cleanup?.();
}
console.log('PASS analytics visit consent: denied, revoked during async auth, unmounted route and one allowed event; no real network');
