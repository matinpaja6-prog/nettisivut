import { readFileSync } from 'node:fs';
import { createTestLoader } from './test-module-loader.mjs';
const file=process.argv[2];
if(!file) { console.error('Usage: node scripts/report-measurements.mjs <GA4-BigQuery-export.json>'); process.exit(2); }
const input=JSON.parse(readFileSync(file,'utf8'));
const events=Array.isArray(input)?input:input.events;
if(!Array.isArray(events)) throw new Error('Expected a GA4 event array or {events:[...]}.');
const {summarizeMeasurement}=createTestLoader()('lib/measurement-report.ts');
console.log(JSON.stringify(summarizeMeasurement(events),null,2));
