import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../',import.meta.url));
const require = createRequire(import.meta.url);
export function createTestLoader(overrides = {}, globals = {}) {
  const cache = new Map();
  const load = file => {
    let path = resolve(root,file);
    if (!existsSync(path)) path += existsSync(path+'.ts') ? '.ts' : '.tsx';
    if (cache.has(path)) return cache.get(path).exports;
    const {outputText} = ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},fileName:path});
    const compiledModule = {exports:{}}; cache.set(path,compiledModule);
    const env = {
      process:{env:{}},
      fetch:()=>{throw new Error('Network is forbidden in isolated tests');},
      ...globals
    };
    new Function('require','module','exports',...Object.keys(env),outputText)(name=>{
      if (name in overrides) return overrides[name];
      if (name==='server-only') return {};
      if (name.startsWith('@/')) return load(name.slice(2));
      if (name.startsWith('.')) return load(resolve(dirname(path),name));
      if (['next/server','react','stripe'].includes(name)) return require(name);
      throw new Error('Unmocked dependency: '+name);
    }, compiledModule,compiledModule.exports,...Object.values(env));
    return compiledModule.exports;
  };
  return load;
}
export function testDatabase(initial = {}) {
  const tables = structuredClone(initial);
  const calls=[];
  const admin={from(table) {
    const call={table,operation:'select',filters:[],values:null}; calls.push(call);
    let single=false;
    const q={
      select(){return q;},order(){return q;},limit(){return q;},returns(){return q;},
      eq(key,value){call.filters.push(row=>row[key]===value);return q;},
      neq(key,value){call.filters.push(row=>row[key]!==value);return q;},
      in(key,values){call.filters.push(row=>values.includes(row[key]));return q;},
      insert(values){call.operation='insert';call.values=values;return q;},
      upsert(values){call.operation='upsert';call.values=values;return q;},
      update(values){call.operation='update';call.values=values;return q;},
      single(){single=true;return q;},maybeSingle(){single=true;return q;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        tables[table] ||= [];
        if (call.operation==='insert' && table==='stripe_webhook_events' && tables[table].some(row=>row.stripe_event_id===call.values.stripe_event_id)) return {data:null,error:{code:'23505'}};
        let rows=tables[table].filter(row=>call.filters.every(test=>test(row)));
        if (call.operation==='insert'||call.operation==='upsert') {
          rows=(Array.isArray(call.values)?call.values:[call.values]).map(value=>({id:'mock-'+tables[table].length,...value}));
          tables[table].push(...rows);
        } else if (call.operation==='update') rows.forEach(row=>Object.assign(row,call.values));
        return {data:single ? rows[0]??null : rows,error:null};
      }).then(resolve,reject);}
    };return q;
  },rpc:async()=>{throw new Error('Unmocked RPC');}};
  return {admin,tables,calls};
}
