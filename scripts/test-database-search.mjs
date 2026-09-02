import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { PGlite } from '@electric-sql/pglite';
import { createTestLoader } from './test-module-loader.mjs';
const load=createTestLoader();
const {buildDatabaseListingFilters:compile}=load('lib/database-listing-filters.ts');
const location=load('lib/location-filter.ts');
const db=new PGlite({extensions:{pg_trgm}});
await db.exec([
'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;',
'CREATE TABLE public.profiles(id uuid PRIMARY KEY,account_type text,company_verified_at timestamptz);',
'CREATE TABLE public.products(id uuid PRIMARY KEY,active boolean,stock_quantity integer);',
"CREATE TABLE public.listings(id uuid PRIMARY KEY,seller_id uuid,listing_number integer,title text,description text,price text,vehicle_type text,brand text,model text,part_number text,year text,engine_cc text,engine_model text,category text,subcategory text,location text,condition text,company_name text,translations jsonb DEFAULT '{}',is_sold boolean DEFAULT false,is_hidden boolean DEFAULT false,created_at timestamptz DEFAULT now());"
].join('\n'));
await db.exec(readFileSync(new URL('../supabase/maintenance/public-listing-advanced-search.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/maintenance/public-listing-numeric-price.sql',import.meta.url),'utf8'));
const defaults={query:'',category:'',subcategory:'',vehicleType:'',vehicleSubtype:'',selectedBrand:'Kaikki',modelQuery:'',identifierQuery:'',locationQuery:'',yearQuery:'',yearMinQuery:'',yearMaxQuery:'',engineCcQuery:'',engineModelQuery:'',vehicleMileageMinQuery:'',vehicleMileageMaxQuery:'',vehicleHoursMinQuery:'',vehicleHoursMaxQuery:'',vehicleRegistrationQuery:'',vehicleEngineKindQuery:'',vehicleDriveTypeQuery:'',vehicleRoadLegalQuery:'',vehicleAccessoriesQuery:[],vehicleColorsQuery:[],trackMatDimensionQuery:'',minPrice:0,maxPrice:100000,garageFilterId:'',gearTypeQuery:[],gearBrandOptionsQuery:[],gearSizeOptionsQuery:[],gearBrandQuery:'',gearSizeQuery:'',gearConditionQuery:'',gearTargetQuery:'',sellerType:''};
const seller='00000000-0000-4000-8000-000000000001';
await db.query('INSERT INTO profiles VALUES ($1,$2,now())',[seller,'company']);
const description='Ajokilometrit: 12 000 km\nKäyttötunnit: 250 h\nRekisteritunnus: ABC-123\nMoottorin tyyppi: 4-tahti\nVetotapa: Neliveto\nTieliikennekelpoisuus: Kyllä\nLisävarusteet: Huoltokirja, Peruutusvaihde\nAjoneuvon väri: Musta, Punainen';
const base={id:'00000000-0000-4000-8000-000000000002',seller_id:seller,listing_number:42,title:'Yamaha Grizzly 700',description,price:5500,brand:'Yamaha',model:'Grizzly',vehicle_type:'Mönkijä',category:'Ajoneuvot',subcategory:'',year:'2020',engine_cc:'700',location:'Kuopio, Finland',translations:{_meta:{vat_deductible:true,tax_free:true,vehicle_subtype:'Traktorimönkijä'}}};
async function insert(row) { await db.query('INSERT INTO listings SELECT * FROM jsonb_populate_record(NULL::listings,$1::jsonb)',[JSON.stringify({created_at:'2026-09-02T10:00:00Z',is_sold:false,is_hidden:false,...row})]); }
await insert(base);
await insert({...base,id:'00000000-0000-4000-8000-000000000003',is_hidden:true});
await insert({...base,id:'00000000-0000-4000-8000-000000000004',is_sold:true});
const ids=async(filter={},mode='all',options={})=>(await db.query('SELECT id FROM public.maskines_search_listings($1::jsonb) ORDER BY id',[JSON.stringify(compile({...defaults,...filter},mode,options))])).rows.map(r=>r.id);
assert.deepEqual(await ids(),[base.id]);
let checked=0;
for (const [filter,yes,no] of [
 ['vehicleType','Mönkijä','Mopo'],['vehicleSubtype','Traktorimönkijä','Moottorikelkka'],
 ['selectedBrand','Yamaha','Honda'],['modelQuery','Grizzly','DT'],
 ['yearMinQuery','2019','2021'],['yearMaxQuery','2021','2019'],['yearQuery','2020','2021'],
 ['identifierQuery','ID 42','ID 43'],['engineCcQuery','700','600'],
 ['vehicleMileageMinQuery','12000','12001'],['vehicleMileageMaxQuery','12000','11999'],
 ['vehicleHoursMinQuery','250','251'],['vehicleHoursMaxQuery','250','249'],
 ['vehicleRegistrationQuery','ABC123','ABC124'],['vehicleEngineKindQuery','4-tahti','2-tahti'],
 ['vehicleDriveTypeQuery','Neliveto','Takaveto'],['vehicleRoadLegalQuery','Kyllä','Ei'],
 ['vehicleAccessoriesQuery',['Huoltokirja','Peruutusvaihde'],['Huoltokirja','ABS']],
 ['vehicleColorsQuery',['Sininen','Musta'],['Sininen']],
 ['sellerType','verified-company','private'],['locationQuery','Kuopio','Helsinki'],
 ['minPrice',5500,5501],['maxPrice',5500,5499],
]) {
 assert.equal((await ids({[filter]:yes})).length,1,filter+' matches');
 assert.equal((await ids({[filter]:no})).length,0,filter+' rejects'); checked+=2;
}
assert.equal((await ids({vehicleVatDeductibleQuery:true,vehicleTaxFreeQuery:true},'vehicles')).length,1);
assert.equal((await ids({},'parts')).length,0);
assert.equal((await ids({garageFilterId:'garage'},'all',{garage:{id:'garage',make:'Yamaha',model:'Grizzly'}})).length,1);
assert.equal((await ids({modelQuery:'Grizzly'},'all',{excludedModelVariants:['Grizzly 700']})).length,0);
for(const selection of [{countries:['FI'],regions:[],municipalities:[]},{countries:[],regions:['Pohjois-Savo'],municipalities:[]},{countries:['FI'],regions:[],municipalities:['Helsinki']},{countries:['SE'],regions:[],municipalities:[]}]) {
 const value=location.serializeLocationFilter(selection);
 assert.equal((await ids({locationQuery:value})).length>0,location.listingMatchesLocationFilter(base.location,value),'location parity');
}
const gear={...base,id:'00000000-0000-4000-8000-000000000005',title:'Fox V1 kypärä koko M miehet',description:'Uusi ajovaruste',category:'Ajovarusteet',subcategory:'Kypärät',condition:'Uusi',brand:'Fox',model:'V1',part_model:'Koko M',translations:{}};
await insert(gear);
for(const filter of [{gearTypeQuery:['Kypärä']},{gearBrandOptionsQuery:['Fox']},{gearBrandQuery:'Fox'},{gearSizeOptionsQuery:['M']},{gearSizeQuery:'M'},{gearConditionQuery:'Uusi'},{gearTargetQuery:'miehet'}]) assert.equal((await ids(filter,'gear')).length,1,JSON.stringify(filter));
assert.equal((await ids({gearBrandOptionsQuery:['Arai']},'gear')).length,0);
await insert({...base,id:'00000000-0000-4000-8000-000000000006',title:'Telamatto 154 15 2.5',category:'Alusta & telasto',subcategory:'Telamatot',engine_model:'850 E-TEC'});
assert.equal((await ids({category:'Telasarjat',trackMatDimensionQuery:'154 15 / 165',engineModelQuery:'E-TEC'},'parts')).length,1);
assert.equal((await ids({subcategory:'Telamatot'},'parts')).length,1);
assert.equal((await ids({subcategory:'Telasto'},'parts',{subcategories:['Telamatot']})).length,1);
assert.equal((await db.query('SELECT count(*)::int AS count FROM maskines_search_listings($1) l WHERE maskines_price_numeric(l)>=5500',[JSON.stringify(compile(defaults,'all'))])).rows[0].count,3);
assert.equal((await db.query('SELECT id FROM maskines_search_listings($1) ORDER BY id LIMIT 1 OFFSET 1',[JSON.stringify(compile(defaults,'all'))])).rows[0].id,gear.id);
// RPC must obey caller RLS even when its predicate accepts everything.
await db.exec("ALTER TABLE listings ENABLE ROW LEVEL SECURITY; CREATE POLICY public_visible ON listings FOR SELECT TO anon USING (id='"+base.id+"'); GRANT USAGE ON SCHEMA public TO anon; GRANT SELECT ON listings,profiles,products TO anon; SET ROLE anon;");
assert.deepEqual(await ids(),[base.id]);
await db.exec('RESET ROLE');
await db.query('INSERT INTO products VALUES ($1,true,0)',[gear.id]);
await db.query("UPDATE listings SET translations=jsonb_build_object('_meta',jsonb_build_object('commerce_product_id',$1::text)) WHERE id=$2",[gear.id,gear.id]);
assert.equal((await ids({},'gear')).length,0);
const plan=(await db.query('EXPLAIN SELECT id FROM maskines_search_listings($1) l WHERE maskines_price_numeric(l)>6000 LIMIT 1',[JSON.stringify(compile(defaults,'all'))])).rows.map(row=>row['QUERY PLAN']).join('\n');
assert.ok(!plan.includes('Function Scan on maskines_search_listings'),'RPC inlining for database pagination/filter pushdown');
console.log('PASS PostgreSQL: '+checked+' positive/negative advanced checks; gear, taxonomy, garage, location parity, count, pagination, RLS, sold/hidden/stock, query inlining.');

const indexes=readFileSync(new URL('../supabase/maintenance/public-listing-search-indexes.sql',import.meta.url),'utf8').replace(/--[^\r\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean);
for (const statement of indexes) await db.exec(statement);
const valid=(await db.query("SELECT count(*)::int AS n FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname LIKE 'listings_public_%' AND i.indisvalid AND i.indisready")).rows[0].n;
assert.equal(valid,7);
console.log('PASS seven concurrent indexes: separate non-transactional statements, pg_trgm extension, valid/ready index catalog.');
for (const [value,expected] of [['20',20],['100',100],['1100',1100],['1 250,50',1250.5],['0',0],['',null],['NaN',null],['-20',null],['on request',null]]) {
 const result=await db.query('SELECT maskines_price_numeric(jsonb_populate_record(NULL::listings,$1::jsonb)) AS price',[JSON.stringify({price:value})]);
 assert.equal(result.rows[0].price===null?null:Number(result.rows[0].price),expected,'numeric price '+value);
}
await db.exec('GRANT USAGE ON SCHEMA public TO authenticated; GRANT SELECT ON listings,profiles,products TO authenticated;');
await db.exec("CREATE POLICY authenticated_visible ON listings FOR SELECT TO authenticated USING (id='"+base.id+"'); SET ROLE authenticated;");
assert.deepEqual(await ids(),[base.id],'Authenticated caller also obeys RLS');
await db.exec('RESET ROLE');
console.log('PASS production-shaped schema: text prices, no part_model column, numeric computed price, authenticated RLS.');
await db.close();
