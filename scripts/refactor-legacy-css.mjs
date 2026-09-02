import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import postcss from 'postcss';

const directory = new URL('../app/styles/legacy/', import.meta.url);
const sourceFile = new URL('../app/styles/legacy.css', import.meta.url);
const source = readFileSync(sourceFile, 'utf8');
if (source.includes('@import "./legacy/')) throw new Error('Already split; use the verification script.');
const parsed = postcss.parse(source);
const chunks = [];
let nodes = [], bytes = 0;
for (const node of parsed.nodes) {
  const size = Buffer.byteLength(node.toString());
  if (bytes + size > 48000 && nodes.length) { chunks.push(nodes); nodes = []; bytes = 0; }
  nodes.push(node); bytes += size;
}
if (nodes.length) chunks.push(nodes);
const groups = ['navigation','profile','auth','home','listing','filters','commerce','messages','shared'];
const patterns = [/topbar|bottom-nav|nav-|dropdown/, /pf-|profile|company-seller/, /auth-|register|login|password/, /home-|hero/, /listing|card|favorite/, /filter|category|search/, /commerce|cart|checkout|order|storefront/, /message|chat|conversation/];
const files = chunks.map((children, index) => {
  const root = postcss.root({nodes: children.map(node => node.clone())});
  const scores = groups.map(()=>0);
  root.walkRules(rule => { const match = patterns.findIndex(pattern=>pattern.test(rule.selector)); scores[match < 0 ? 8 : match]++; });
  const group = groups[scores.indexOf(Math.max(...scores))];
  return { name: `${String(index+1).padStart(2,'0')}-${group}.css`, css: root.toString()+'\n' };
});
const semantic = node => {
  const result = {};
  for (const key of ['type','selector','name','params','prop','value','important','text']) if (node[key] !== undefined) result[key] = node[key];
  if (node.nodes) result.nodes = node.nodes.map(semantic);
  return result;
};
const fingerprint = css => createHash('sha256').update(JSON.stringify(semantic(postcss.parse(css)))).digest('hex');
const before = fingerprint(source), after = fingerprint(files.map(file=>file.css).join('\n'));
if (before !== after) throw new Error('Cascade or rules changed; refusing the split.');
if (process.argv.includes('--apply')) {
  mkdirSync(directory,{recursive:true});
  for (const file of files) writeFileSync(new URL(file.name,directory),file.css);
  writeFileSync(sourceFile,'/* Ordered legacy cascade. Keep this order: specificity ties depend on it.\n * New feature styles belong in dedicated files, not in these historical layers.\n * Verify with: node scripts/verify-legacy-css.mjs\n */\n'+files.map(file=>`@import "./legacy/${file.name}";`).join('\n')+'\n');
  writeFileSync(new URL('manifest.json',directory),JSON.stringify({semanticSha256:before,originalBytes:Buffer.byteLength(source),files:files.map(file=>file.name)},null,2)+'\n');
}
console.log(JSON.stringify({applied:process.argv.includes('--apply'),files:files.map(file=>file.name),semanticSha256:before,originalBytes:Buffer.byteLength(source)},null,2));
