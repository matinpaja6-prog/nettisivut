import assert from 'node:assert/strict';
import {createTestLoader} from './test-module-loader.mjs';
let consent=false;const sent=[],memory=new Map();
const load=createTestLoader({'./cookie-consent':{readCookieConsentSettings:()=>({analytics:consent})}},{
 process:{env:{NEXT_PUBLIC_GA_MEASUREMENT_ID:'G-TEST1234'}},
 window:{location:{origin:'https://maskines.com',pathname:'/en/tilaus/onnistui',search:'?session_id=secret'},gtag:(...args)=>sent.push(args),sessionStorage:{getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)}}
});
const analytics=load('lib/analytics.ts');
const purchase={id:'fixture-order',totalCents:1255,shippingCents:100,taxCents:255,itemCount:1,language:'en'};
assert.equal(analytics.trackPurchaseOnce(purchase),false);
assert.equal(memory.size,0);
consent=true;
assert.equal(analytics.trackPurchaseOnce(purchase),true);
assert.equal(analytics.trackPurchaseOnce(purchase),false);
assert.equal(sent[0][2].value,9);
assert.equal(sent[0][2].order_total,12.55);
assert.equal(sent[0][2].page_location,'https://maskines.com/en/tilaus');
assert.ok(!JSON.stringify(sent).includes('secret'));
assert.equal(sent.length,1);
assert.deepEqual(analytics.measurementPage('/en/messages/private-id?secret=hidden'),{language:'en',page_path:'/en/messages'});
const glossary=load('lib/part-glossary.ts');
assert.equal(glossary.validTechnicalTranslation('Kaasutin 32 mm','Carburetor 320 mm','en'),false);
assert.equal(glossary.validTechnicalTranslation('OEM 123 123','OEM 123','en'),false);
assert.equal(glossary.validTechnicalTranslation('Kaasutin 32 mm','Carburetor 32 mm','en'),true);
const {summarizeMeasurement}=load('lib/measurement-report.ts');
const synthetic=Array.from({length:100},(_,i)=>({event_name:'web_vital',event_timestamp:i,device:{category:'mobile'},parameters:{metric_id:'fixture-'+i,metric_name:'LCP',metric_value:(i+1)*10,language:'en'}}));
synthetic.push({...synthetic[0],event_timestamp:200,parameters:{...synthetic[0].parameters,metric_value:20}});
synthetic.push({event_name:'page_view',user_pseudo_id:'fixture-user',parameters:{ga_session_id:1}});
synthetic.push({event_name:'purchase',user_pseudo_id:'fixture-user',parameters:{ga_session_id:1,transaction_id:'fixture'}});
synthetic.push({event_name:'purchase',user_pseudo_id:'fixture-user',parameters:{ga_session_id:1,transaction_id:'fixture'}});
const report=summarizeMeasurement(synthetic);
assert.equal(report.vitals[0].samples,100);
assert.equal(report.vitals[0].p75,750);
assert.equal(report.vitals[0].status,'good');
assert.equal(report.conversions.uniqueTransactions,1);
assert.equal(report.conversions.paidSessionRate,1);
assert.equal(report.conversions.status,'insufficient_sample');
assert.equal(summarizeMeasurement([]).conversions.paidSessionRate,null);
console.log('PASS synthetic-only fixtures: consent, purchase deduplication, private URL sanitization, exact technical numbers, p75, vital deduplication, conversion denominator and sample guard.');
