// GET-only smoke test against the configured public catalogue; never uses a service-role key.
import { createRequire } from 'node:module';
import { createTestLoader } from './test-module-loader.mjs';
const require = createRequire(import.meta.url);
if (!process.argv.includes('--remote-read-only')) throw new Error('Pass --remote-read-only to query the configured public catalogue.');
createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const { listingSearchClauses } = createTestLoader()('lib/listing-query.ts');
for (const query of ['carburetor', 'förgasare', 'forgasser', '420685756']) {
  let request = client.from('listings').select('id,listing_number,title').eq('is_sold',false).eq('is_hidden',false).limit(24);
  for (const clause of listingSearchClauses(query)) request = request.or(clause);
  const { data, error } = await request;
  console.log(JSON.stringify({ query, error: error ? { code: error.code, message: error.message } : null, matches: data?.map(row=>({number:row.listing_number,title:row.title})) }));
  if (error) process.exitCode = 1;
}
