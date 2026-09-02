// Local production-build diagnostic, not real-user Core Web Vitals.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const base = new URL(process.argv.find(v => v.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:3100/');
if (!['127.0.0.1','localhost','[::1]'].includes(base.hostname)) throw new Error('Localhost only.');
const label = process.argv.find(v => v.startsWith('--label='))?.slice(8) || 'sample';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Invalid label.');
const samples = [];
let html = '';
for (let i=0;i<3;i++) {
  const start = performance.now();
  const response = await fetch(base, {signal:AbortSignal.timeout(45000)});
  if (!response.ok) throw new Error('HTTP '+response.status);
  html = await response.text();
  samples.push(Math.round(performance.now()-start));
}
const decode = v => v.replaceAll('&amp;','&');
const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>decode(m[1])))].filter(v=>v.startsWith('/_next/'));
const styles = [...new Set([...html.matchAll(/<link[^>]+href="([^"]+\.css[^\"]*)"/g)].map(m=>decode(m[1])))];
async function assets(paths) {
  return Promise.all(paths.map(async path => {
    const response = await fetch(new URL(path,base),{signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Asset HTTP '+response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    return {path,bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
  }));
}
const js = await assets(scripts), css = await assets(styles);
const sum = (items,key) => items.reduce((n,item)=>n+item[key],0);
const report = {
  label, generatedAt:new Date().toISOString(), url:base.href,
  method:'Three sequential local HTTP GETs; gzip is calculated from response bodies. No CPU/network throttling. Not LCP/INP/CLS, not production speed improvement.',
  htmlBytes:Buffer.byteLength(html),htmlGzipBytes:gzipSync(html).length,htmlResponseMs:samples,
  initialJavaScript:{files:js.length,bytes:sum(js,'bytes'),gzipBytes:sum(js,'gzipBytes')},
  css:{files:css.length,bytes:sum(css,'bytes'),gzipBytes:sum(css,'gzipBytes')},
  imagePreloads:(html.match(/<link[^>]+as="image"/g)||[]).length,
  js,cssAssets:css
};
mkdirSync(new URL('../output/performance/',import.meta.url),{recursive:true});
writeFileSync(new URL('../output/performance/'+label+'.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,js:undefined,cssAssets:undefined},null,2));
