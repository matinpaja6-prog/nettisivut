// Bounded GET-only checks of the installed public RPC. No service key or writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createTestLoader } from './test-module-loader.mjs';
if (!process.argv.includes('--remote-read-only')) throw new Error('Pass --remote-read-only.');
const require = createRequire(import.meta.url);
createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(process.cwd());
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!base || !key) throw new Error('Public Supabase configuration missing.');
const { listingSearchClauses } = createTestLoader()('lib/listing-query.ts');
const { listingProjection } = createTestLoader()('lib/listing-query-shape.ts');
const columns = 'id,listing_number,title,brand,model,year,part_number,price,created_at,is_hidden,is_sold';
let checks = 0;
const blockers = [];
async function get(path, params) {
  const response = await fetch(base+'/rest/v1/'+path+'?'+params, {
    method:'GET',headers:{apikey:key,Prefer:'count=exact'},signal:AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('Public query HTTP '+response.status+' '+(await response.text()).slice(0,500));
  return {rows:await response.json(),count:Number(response.headers.get('content-range')?.split('/')[1])};
}
async function rpc(predicate={all:[]}, {order='created_at.desc,id.desc',offset=0,limit=20,query=''}={}) {
  const select = listingProjection(columns.split(','),order.split('.')[0],true);
  const params = new URLSearchParams({search_filter:JSON.stringify(predicate),select,order,offset:String(offset),limit:String(limit)});
  for (const clause of listingSearchClauses(query)) params.append('or','('+clause+')');
  const result = await get('rpc/maskines_search_listings',params);
  assert.ok(result.rows.every(row=>row.is_sold===false && row.is_hidden===false),'No sold/hidden listings');
  checks++;
  return result;
}
const publicRows = await get('listings',new URLSearchParams({select:columns,is_hidden:'eq.false',is_sold:'eq.false',limit:'200',order:'created_at.desc,id.desc'}));
const all = await rpc({all:[]},{limit:200});
assert.ok(all.rows.length>0,'Public catalogue has testable inventory');
assert.ok(all.rows.every(row=>publicRows.rows.some(item=>item.id===row.id)),'RPC returns only publicly readable rows');
assert.equal(all.count,all.rows.length,'Fixture catalogue fits bounded snapshot (200)');
const ids = rows => rows.map(row=>row.id);
const [page1,page2] = await Promise.all([rpc({all:[]},{limit:5}),rpc({all:[]},{limit:5,offset:5})]);
assert.deepEqual(ids([...page1.rows,...page2.rows]),ids(all.rows.slice(0,10)),'Stable non-overlapping pagination');
assert.equal(page1.count,all.count,'Exact total is independent of limit');
try {
  const price = await rpc({all:[]},{order:'maskines_price_numeric.asc.nullslast,id.desc',limit:200});
  const number = row => {
    const value = String(row.price ?? '').replace(/[\s\u00a0]/g,'').replace(',','.');
    return /^[0-9]{1,12}([.][0-9]{1,6})?$/.test(value) ? Number(value) : Infinity;
  };
  assert.ok(price.rows.every((row,i)=>!i || number(price.rows[i-1])<=number(row)), 'Price ordering: '+JSON.stringify(price.rows.map(row=>row.price)));
  for (const direction of ['asc','desc']) {
    const order = `maskines_price_numeric.${direction}.nullslast,id.desc`;
    const whole = await rpc({all:[]},{order,limit:200});
    const first = await rpc({all:[]},{order,limit:24});
    const second = await rpc({all:[]},{order,limit:24,offset:24});
    assert.deepEqual(ids([...first.rows,...second.rows]),ids(whole.rows),'Numeric pagination '+direction);
    assert.equal(first.count,all.count);
    assert.ok(whole.rows.every((row,i)=> {
      if (!i) return true;
      const previous=number(whole.rows[i-1]),current=number(row);
      if (previous===Infinity) return current===Infinity;
      if (current===Infinity) return true; // NULLS LAST in both directions.
      return direction==='asc' ? previous<=current : previous>=current;
    }), 'Numeric direction '+direction);
    assert.ok(whole.rows.every(row=>Object.keys(row).every(key=>columns.split(',').includes(key)||key==='maskines_price_numeric')),'No unrequested listing fields');
  }
} catch (error) {
  if (!error.message.includes('column listings.maskines_price_numeric does not exist')) throw error;
  blockers.push('Apply supabase/maintenance/public-listing-numeric-price.sql, then rerun this entire test before enabling the database filter flag.');
}
const sample = all.rows.find(row=>row.brand && row.model && row.year);
assert.ok(sample,'Brand/model/year sample');
const combined = await rpc({all:[
  {field:'brand',op:'equal',value:sample.brand},
  {field:'model',op:'equal',value:sample.model},
  {field:'year',op:'equal',value:String(sample.year)}
]},{limit:200});
assert.ok(combined.rows.some(row=>row.id===sample.id),'Combined filter preserves matching sample');
assert.ok(combined.rows.every(row=>row.brand===sample.brand && row.model===sample.model && String(row.year)===String(sample.year)),'Combined filter excludes other listings');
for (const query of ['kaasutin','carburetor','förgasare','forgasser']) {
  const result = await rpc({all:[]},{query});
  assert.ok(result.rows.length>0,'Translated search alias '+query);
}
const oem = all.rows.find(row=>String(row.part_number||'').replace(/[^0-9]/g,'').length>=6);
if (oem) assert.ok((await rpc({all:[]},{query:oem.part_number})).rows.some(row=>row.id===oem.id),'OEM lookup');
const noResult = await rpc({field:'id',op:'equal',value:'maskines-no-such-listing-fixture'});
assert.equal(noResult.count,0); assert.equal(noResult.rows.length,0);
const limitedPrice = await rpc({field:'price',op:'max',value:'100'},{limit:200});
assert.ok(limitedPrice.rows.every(row=>Number(row.price)<=100),'Price predicate');
for (const kind of ['parts','vehicles','gear']) await rpc({field:'kind',op:'equal',value:kind});
console.log(JSON.stringify({status:blockers.length?'BLOCKED':'PASS',method:'Anonymous GET only; bounded public catalogue',checks,publicRows:all.rows.length,combinedMatches:combined.rows.length,authenticatedProductionTest:false,blockers},null,2));
if (blockers.length) process.exitCode=1;
