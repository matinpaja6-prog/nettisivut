// Public, bounded, GET-only snapshot. No seller details, descriptions or IDs
// are written to the audit output; only aggregate counts and public URLs.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createTestLoader } from './test-module-loader.mjs';
if (!process.argv.includes('--remote-read-only')) throw new Error('Pass --remote-read-only');
const require = createRequire(import.meta.url);
createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(process.cwd());
const load = createTestLoader({ 'lucide-react': require('lucide-react') });
const { buildSeoCollectionCatalog, MIN_INDEXABLE_COLLECTION_LISTINGS } = load('lib/seo-collection-policy.ts');
const params = new URLSearchParams({ select:'id,title,description,brand,model,year,vehicle_type,category,subcategory,part_number,engine_model,is_hidden,is_sold', is_hidden:'eq.false', is_sold:'eq.false', limit:'501', order:'id.asc' });
const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/listings?'+params, {
  headers: { apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, signal:AbortSignal.timeout(20000)
});
if (!response.ok) throw new Error('Public inventory HTTP '+response.status);
const listings = await response.json();
if (listings.length > 500) throw new Error('Snapshot exceeds 500; use a paginated full audit before drawing conclusions');
const catalog = buildSeoCollectionCatalog(listings);
const report = { generatedAt:new Date().toISOString(), publicListings:listings.length,
  minimumListings:MIN_INDEXABLE_COLLECTION_LISTINGS, candidates:catalog.length,
  counts:Object.fromEntries(['indexable','small-inventory','duplicate-results','empty'].map(reason=>[reason,catalog.filter(row=>row.reason===reason).length])),
  pages:catalog.map(({path,canonicalPath,reason,matches})=>({path,canonicalPath,reason,matches:matches.length}))
};
mkdirSync(new URL('../output/seo/',import.meta.url),{recursive:true});
writeFileSync(new URL('../output/seo/collection-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,pages:report.pages.filter(row=>row.reason==='indexable')},null,2));
