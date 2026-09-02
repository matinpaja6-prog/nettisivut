import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function jsxValue(raw) {
  const result = ts.transpileModule("const value = <span>" + raw + "</span>;", { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } });
  const compiled = ts.createSourceFile("text.js", result.outputText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  let value = null;
  const visit = node => {
    if (ts.isCallExpression(node) && node.arguments.length === 3 && ts.isStringLiteral(node.arguments[2])) value = node.arguments[2].text;
    ts.forEachChild(node, visit);
  };
  visit(compiled);
  return value;
}
let files = 0, texts = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "api") walk(file); continue; }
    if (!file.endsWith(".tsx") || /(?:UiText|AutoTranslate)\.tsx$/.test(file)) continue;
    const source = fs.readFileSync(file,"utf8");
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    const edits = [];
    function visit(node) {
      if (ts.isJsxElement(node) && ["style","script","code","pre"].includes(node.openingElement.tagName.getText(tree))) return;
      if (ts.isJsxText(node) && /[a-zA-ZÀ-ž]/.test(node.text)) {
        const value = jsxValue(source.slice(node.pos,node.end));
        if (value && value.trim()) edits.push({start:node.pos,end:node.end,text:"<UiText text={"+JSON.stringify(value)+"} />"});
      }
      ts.forEachChild(node,visit);
    }
    visit(tree);
    if (!edits.length) continue;
    let result=source;
    for(const edit of edits.reverse()) result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
    const importLine='import UiText from "@/app/components/UiText";\n';
    const directive=result.match(/^\uFEFF?["']use client["'];\r?\n/);
    result=directive?result.slice(0,directive[0].length)+importLine+result.slice(directive[0].length):importLine+result;
    fs.writeFileSync(file,result);
    files++; texts+=edits.length;
  }
}
walk("app");
console.log(JSON.stringify({files,texts}));
