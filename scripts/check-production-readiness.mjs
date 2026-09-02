import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadEnvConfig } = createRequire(require.resolve('next/package.json'))('@next/env');
import Stripe from 'stripe';
loadEnvConfig(fileURLToPath(new URL('../',import.meta.url)));
const report = {
  deploymentPerformed:false,
  databaseSqlConnection:Boolean(process.env.MASKINES_DATABASE_URL || process.env.DATABASE_URL),
  advancedDatabaseFiltersEnabled:process.env.NEXT_PUBLIC_MARKETPLACE_DB_FILTERS === 'true',
  analyticsIdConfigured:/^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''),
  searchConsoleVerificationConfigured:Boolean(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION),
  stripeMode:/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '') ? 'live' : /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || '') ? 'test' : 'missing',
  localWebhookSecretConfigured:Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  localConnectWebhookSecretConfigured:Boolean(process.env.STRIPE_CONNECT_WEBHOOK_SECRET)
};
if (process.argv.includes('--remote-read-only')) {
  if (report.stripeMode !== 'missing') {
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{maxNetworkRetries:0,timeout:15000});
    try {
      const account=await stripe.accounts.retrieve();
      report.stripeAccount={readable:true,chargesEnabled:account.charges_enabled,payoutsEnabled:account.payouts_enabled};
    } catch(error) { report.stripeAccount={readable:false,errorCode:error.code || error.type || 'unknown'}; }
    try {
      const endpoints=await stripe.webhookEndpoints.list({limit:100});
      const matching=endpoints.data.filter(endpoint=>{
        try{return new URL(endpoint.url).pathname==='/api/commerce/stripe/webhook';}catch{return false;}
      });
      report.stripeWebhookEndpoints={matching:matching.length,enabled:matching.filter(e=>e.status==='enabled').length};
    } catch(error) { report.stripeWebhookEndpoints={readable:false,errorCode:error.code || error.type || 'unknown'}; }
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(url && key) {
    report.databaseDependencies = {};
    for (const [table, columns] of Object.entries({listings:"id,seller_id,is_sold,is_hidden,title,description,price,brand,model,year,part_number,translations",profiles:"id,account_type,company_verified_at",products:"id,active,stock_quantity"})) {
      try {
        const response = await fetch(url+"/rest/v1/"+table+"?select="+columns+"&limit=0", {headers:{apikey:key},signal:AbortSignal.timeout(15000)});
        report.databaseDependencies[table] = {readable:response.ok,status:response.status};
      } catch { report.databaseDependencies[table] = {readable:false,errorCode:"network_error"}; }
    }
    try{
      const response=await fetch(url+'/rest/v1/rpc/maskines_search_listings?search_filter='+encodeURIComponent('{"all":[]}')+'&limit=0',{
        method:'GET',headers:{apikey:key},signal:AbortSignal.timeout(15000)
      });
      report.advancedSearchRpc={readable:response.ok,status:response.status};
    } catch { report.advancedSearchRpc={readable:false,errorCode:'network_error'}; }
  }
}
console.log(JSON.stringify(report,null,2));
