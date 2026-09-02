import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createTestLoader } from './test-module-loader.mjs';
const root=new URL('../',import.meta.url);
const require=createRequire(import.meta.url);
createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(fileURLToPath(root));
const {validTechnicalTranslation}=createTestLoader()('lib/part-glossary.ts');
const {getLocalizedListingText}=createTestLoader()('lib/listing-translations.ts');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!url || !key) throw new Error('Public Supabase URL/key missing.');
const requested=Number(process.argv.find(arg=>arg.startsWith('--limit='))?.split('=')[1] || 500);
const limit=Math.max(1,Math.min(10000,Number.isFinite(requested)?requested:500));
const records=[];
const totals={listings:0,translations:0,missing:0,unchanged:0,unsafe:0,renderedUnchanged:0,humanReviewPending:0};
for(let offset=0;offset<limit;offset+=100){
 const params=new URLSearchParams({select:'id,title,description,original_language,translations',is_hidden:'eq.false',is_sold:'eq.false',order:'id.asc',offset:String(offset),limit:String(Math.min(100,limit-offset))});
 const response=await fetch(url+'/rest/v1/listings?'+params,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});
 if(!response.ok) throw new Error('Public listing read failed: HTTP '+response.status);
 const listings=await response.json();
 for(const listing of listings){
   totals.listings++;
   const sourceLanguage=listing.original_language || 'fi';
   const record={listingId:listing.id,sourceLanguage,source:{title:listing.title,description:listing.description || ''},sourceFingerprint:createHash('sha256').update(JSON.stringify([listing.title,listing.description || '',sourceLanguage])).digest('hex'),reviews:[]};
   for(const locale of ['fi','en','sv','no'].filter(locale=>locale!==sourceLanguage)){
     totals.translations++;totals.humanReviewPending++;
     const translation=listing.translations?.[locale] || {};
     const rendered=getLocalizedListingText(listing,locale);
     if (rendered.title===listing.title && rendered.description===(listing.description || '')) totals.renderedUnchanged++;
     const flags=[];
     for(const field of ['title','description']){
       const source=record.source[field];
       const value=translation[field] || '';
       if(!source) continue;
       if(!value.trim()) flags.push(field+':missing');
       else if(value.trim()===source.trim()) flags.push(field+':unchanged');
       else if(!validTechnicalTranslation(source,value,locale,sourceLanguage)) flags.push(field+':unsafe_technical_content');
     }
     if(flags.some(flag=>flag.endsWith('missing'))) totals.missing++;
     if(flags.some(flag=>flag.endsWith('unchanged'))) totals.unchanged++;
     if(flags.some(flag=>flag.endsWith('unsafe_technical_content'))) totals.unsafe++;
     record.reviews.push({locale,flags,proposedTitle:translation.title || '',proposedDescription:translation.description || '',renderedTitle:rendered.title,renderedDescription:rendered.description,decision:'pending',reviewer:null,reviewedAt:null,notes:''});
   }
   records.push(record);
 }
 if(listings.length<100) break;
}
const report={generatedAt:new Date().toISOString(),scope:'Public unsold listings only; capped at '+limit,professionalReviewPerformed:false,totals};
if(process.argv.includes('--packet')){
 const directory=new URL('output/quality-review/',root);
 mkdirSync(directory,{recursive:true});
 const file=new URL('translation-review-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json',directory);
 writeFileSync(file,JSON.stringify({...report,instructions:'A competent human reviewer must compare source and every target. Preserve OEM numbers, models, measures, condition, compatibility and delivery terms. Pending means NOT approved. This packet does not update the database.',records},null,2),{flag:'wx'});
 report.packet=fileURLToPath(file);
}
console.log(JSON.stringify(report,null,2));
