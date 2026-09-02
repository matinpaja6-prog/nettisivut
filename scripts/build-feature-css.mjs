import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import postcss from 'postcss';

// The historical files remain the editable source of truth. Never classify a
// whole file by its name: navigation and page rules are interleaved throughout.
const root = new URL('../', import.meta.url);
const legacy = JSON.parse(readFileSync(new URL('app/styles/legacy/manifest.json', root), 'utf8'));
const sources = [...legacy.files.map(name => `app/styles/legacy/${name}`), 'app/styles/themes.css'];
const groups = {
  profile: 'pf-page',
  seller: 'seller-page',
  auth: 'simple-auth-page',
  sell: 'sell-page-responsive',
  garage: 'garage-page'
};
const roots = Object.entries(groups).map(([group, className]) => [group,
  new RegExp(`^(?:(?:html|:root)(?:\\[[^\\]]+\\])?\\s+)?(?:body\\s+)?(?:main)?\\.${className}(?=[\\s.#:\\[>+~]|$)`)
]);

export function featureForSelector(selector) {
  return roots.find(([, pattern]) => pattern.test(selector.trim()))?.[0] || 'shared';
}

function partition(container, target) {
  const clone = container.clone({ nodes: [] });
  for (const node of container.nodes || []) {
    if (node.type === 'rule') {
      // Splitting selector lists is safe: declarations and specificity stay
      // unchanged. Functional selectors containing the root aren't guessed.
      const selectors = postcss.list.comma(node.selector).filter(selector => featureForSelector(selector) === target);
      if (selectors.length) clone.append(node.clone({ selector: selectors.join(', ') }));
    } else if (node.type === 'atrule' && node.nodes && ['media', 'supports', 'container'].includes(node.name)) {
      const child = partition(node, target);
      if (child.nodes.length) clone.append(child);
    } else if (target === 'shared') {
      // Keyframes, fonts, custom properties and unknown at-rules remain global.
      clone.append(node.clone());
    }
  }
  return clone;
}

export function buildFeatureCss() {
  const parsed = postcss.parse(sources.map(file => readFileSync(new URL(file, root), 'utf8')).join('\n'));
  const outputs = Object.fromEntries(['shared', ...Object.keys(groups)].map(group => [group, partition(parsed, group).toString() + '\n']));
  const manifest = {
    sourceSha256: createHash('sha256').update(parsed.toString()).digest('hex'),
    sourceBytes: Buffer.byteLength(parsed.toString()),
    roots: groups,
    files: Object.fromEntries(Object.entries(outputs).map(([name, css]) => [name, {
      bytes: Buffer.byteLength(css), sha256: createHash('sha256').update(css).digest('hex')
    }]))
  };
  return { parsed, outputs, manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { outputs, manifest } = buildFeatureCss();
  const directory = new URL('app/styles/generated/', root);
  if (process.argv.includes('--check')) {
    for (const [name, css] of Object.entries(outputs)) {
      if (readFileSync(new URL(`${name}.css`, directory), 'utf8') !== css) throw new Error(`Stale ${name}.css: run npm run css:build`);
    }
    console.log('PASS feature CSS: generated files match their ordered sources');
  } else {
    mkdirSync(directory, { recursive: true });
    for (const [name, css] of Object.entries(outputs)) writeFileSync(new URL(`${name}.css`, directory), css);
    writeFileSync(new URL('manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify(manifest, null, 2));
  }
}
