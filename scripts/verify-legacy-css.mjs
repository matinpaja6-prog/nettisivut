import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
const directory = new URL('../app/styles/legacy/',import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json',directory),'utf8'));
const index = readFileSync(new URL('../app/styles/legacy.css',import.meta.url),'utf8');
assert.deepEqual([...index.matchAll(/@import "\.\/legacy\/([^"/]+)";/g)].map(match=>match[1]),manifest.files);
const semantic = node => {
  const result = {};
  for (const key of ['type','selector','name','params','prop','value','important','text']) if (node[key] !== undefined) result[key]=node[key];
  if (node.nodes) result.nodes=node.nodes.map(semantic);
  return result;
};
const joined = manifest.files.map(file=>readFileSync(new URL(file,directory),'utf8')).join('\n');
const hash = createHash('sha256').update(JSON.stringify(semantic(postcss.parse(joined)))).digest('hex');
assert.equal(hash,manifest.semanticSha256,'Legacy CSS rules or cascade changed; review and update the baseline intentionally.');
console.log(`PASS CSS: ${manifest.files.length} ordered feature files, original rules and cascade preserved`);
