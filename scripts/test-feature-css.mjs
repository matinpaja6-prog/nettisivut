import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import {buildFeatureCss,featureForSelector} from './build-feature-css.mjs';
const {parsed,outputs,manifest}=buildFeatureCss();
function declarations(root,group) {
  const result=[];
  root.walkRules(rule=>{
    const context=[];let parent=rule.parent;
    while(parent && parent.type!=='root'){context.unshift([parent.name,parent.params]);parent=parent.parent;}
    for(const selector of postcss.list.comma(rule.selector)) {
      if(group && featureForSelector(selector)!==group) continue;
      result.push(JSON.stringify([context,selector.trim(),rule.nodes.map(node=>node.type==='decl'?[node.prop,node.value,Boolean(node.important)]:node.toString())]));
    }
  });
  return result;
}
const expected=declarations(parsed).sort();
const actual=Object.values(outputs).flatMap(css=>declarations(postcss.parse(css))).sort();
assert.deepEqual(actual,expected,'Every original selector/declaration/context survives exactly once');
for(const [group,css] of Object.entries(outputs)) {
  assert.deepEqual(declarations(postcss.parse(css),group),declarations(parsed,group),`${group}: internal source order is unchanged`);
  if(group!=='shared') postcss.parse(css).walkRules(rule=>postcss.list.comma(rule.selector).forEach(selector=>assert.equal(featureForSelector(selector),group,'No unscoped selector leaking after client navigation')));
  assert.equal(css,readFileSync(new URL(`../app/styles/generated/${group}.css`,import.meta.url),'utf8'),'Regenerate changed source CSS');
}
assert.ok(manifest.files.shared.bytes < manifest.sourceBytes*.7,'At least 30% of historical CSS belongs to feature routes, not every page');
for(const selector of ['body .pf-page h2','html[data-theme="light"] body .pf-page.pf-page input','main.pf-page button']) assert.equal(featureForSelector(selector),'profile');
for(const selector of ['.universal-app-topbar .profile-button','body:not(.pf-page) button','body :is(.pf-page,.universal-app-topbar)','body:has(.pf-page)','.seller-page-nav']) assert.equal(featureForSelector(selector),'shared');
console.log('PASS CSS: complete selector/declaration partition, feature source order, strict route scoping, generated-file freshness and shared-bundle budget');
