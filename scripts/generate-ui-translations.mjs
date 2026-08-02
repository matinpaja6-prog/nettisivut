import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");
const OUTPUT = path.join(ROOT, "lib", "generated-ui-translations.ts");
const ALL_TARGETS = ["en", "sv", "no"];
const targetArgument = process.argv.find((argument) => argument.startsWith("--target="));
const requestedTarget = targetArgument?.slice("--target=".length);
const TARGETS = requestedTarget && ALL_TARGETS.includes(requestedTarget)
  ? [requestedTarget]
  : ALL_TARGETS;
const ATTRIBUTE_NAMES = new Set(["alt", "aria-label", "placeholder", "title"]);
const UI_PROPERTY_NAMES = /^(?:answer|ariaLabel|body|caption|content|description|empty|eyebrow|heading|help|hint|intro|kicker|label|lead|message|name|note|placeholder|question|subtitle|summary|tagline|text|title)$/i;
const CURATED_TRANSLATIONS = {
  en: {
    "Maskines ohjekeskus": "Maskines Help Center",
    "Tee löydettävä ilmoitus": "Create an easy-to-find listing",
    "Oikea ajoneuvo, osa ja otsikko.": "Choose the right vehicle, part and title.",
    "Kuvat ja kuntotiedot": "Photos and condition details",
    "Myy useita osia": "Sell multiple parts",
    "Pidä jokainen osa ja hinta selkeänä.": "Keep every part and price clear.",
    "Pidä myynti ajan tasalla": "Keep your listings up to date",
    "Vastaa, päivitä ja merkitse myydyksi.": "Reply, update and mark items as sold."
  },
  sv: {
    "Maskines ohjekeskus": "Maskines hjälpcenter",
    "Tee löydettävä ilmoitus": "Skapa en lättfunnen annons",
    "Oikea ajoneuvo, osa ja otsikko.": "Välj rätt fordon, del och rubrik.",
    "Kuvat ja kuntotiedot": "Bilder och skickuppgifter",
    "Myy useita osia": "Sälj flera delar",
    "Pidä jokainen osa ja hinta selkeänä.": "Håll varje del och dess pris tydliga.",
    "Pidä myynti ajan tasalla": "Håll annonserna uppdaterade",
    "Vastaa, päivitä ja merkitse myydyksi.": "Svara, uppdatera och markera som såld."
  },
  no: {
    "Maskines ohjekeskus": "Maskines hjelpesenter",
    "Tee löydettävä ilmoitus": "Lag en annonse som er lett å finne",
    "Oikea ajoneuvo, osa ja otsikko.": "Velg riktig kjøretøy, del og tittel.",
    "Kuvat ja kuntotiedot": "Bilder og tilstandsopplysninger",
    "Myy useita osia": "Selg flere deler",
    "Pidä jokainen osa ja hinta selkeänä.": "Hold hver del og pris tydelig.",
    "Pidä myynti ajan tasalla": "Hold annonsene oppdatert",
    "Vastaa, päivitä ja merkitse myydyksi.": "Svar, oppdater og merk som solgt."
  }
};

function sourceFile(filePath) {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function appFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "admin" || entry.name === "api") return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return appFiles(fullPath);
    return /\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

function collectRenderedStrings() {
  const values = new Set();

  for (const filePath of appFiles(APP_DIR)) {
    const file = sourceFile(filePath);

    function visit(node) {
      if (ts.isJsxText(node)) {
        const value = node.text.replace(/\s+/g, " ").trim();
        if (value) values.add(value);
      }

      if (
        ts.isJsxAttribute(node) &&
        ATTRIBUTE_NAMES.has(node.name.text) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      ) {
        values.add(node.initializer.text.trim());
      }

      if (ts.isStringLiteralLike(node)) {
        let propertyParent = node.parent;
        while (ts.isArrayLiteralExpression(propertyParent)) {
          propertyParent = propertyParent.parent;
        }
        const property = ts.isPropertyAssignment(propertyParent) ? propertyParent : null;
        const propertyName = property?.name?.getText(file).replace(/["']/g, "") ?? "";
        let parent = node.parent;
        let renderedExpression = false;

        while (parent) {
          if (ts.isJsxExpression(parent)) {
            renderedExpression = true;
            break;
          }
          if (
            !ts.isConditionalExpression(parent) &&
            !ts.isBinaryExpression(parent) &&
            !ts.isParenthesizedExpression(parent)
          ) {
            break;
          }
          parent = parent.parent;
        }

        if (renderedExpression || UI_PROPERTY_NAMES.test(propertyName)) {
          values.add(node.text.trim());
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(file);
  }

  return [...values].filter((value) => {
    if (value.length < 2 || value.length > 500) return false;
    if (!/[A-Za-zÀ-ž]/.test(value)) return false;
    if (/^(https?:\/\/|www\.|\S+@\S+\.\S+)/i.test(value)) return false;
    return !/^[A-Z0-9_.+\-/ ]{1,16}$/.test(value);
  });
}

async function translate(text, target) {
  const query = new URLSearchParams({ client: "gtx", sl: "auto", tl: target, dt: "t", q: text });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${query}`);
    if (response.ok) {
      const payload = await response.json();
      const translated = payload?.[0]?.map((part) => part?.[0] ?? "").join("").trim();
      return translated || text;
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  console.warn(`Keeping untranslated after repeated failures: ${text}`);
  return text;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const result = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return result;
}

function readExistingDictionaries() {
  if (!fs.existsSync(OUTPUT)) return {};

  const source = fs.readFileSync(OUTPUT, "utf8");
  const match = source.match(/export const generatedUiTranslations = ([\s\S]+) as const;\s*$/);
  if (!match) return {};

  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

const strings = collectRenderedStrings();
const dictionaries = requestedTarget ? readExistingDictionaries() : {};

if (process.argv.includes("--missing")) {
  const existingDictionaries = readExistingDictionaries();
  const missing = Object.fromEntries(
    ALL_TARGETS.map((target) => [
      target,
      strings.filter((value) => !Object.hasOwn(existingDictionaries[target] ?? {}, value))
    ])
  );
  console.log(JSON.stringify(missing, null, 2));
  process.exit(0);
}

if (process.argv.includes("--update-missing")) {
  const existingDictionaries = readExistingDictionaries();

  for (const target of TARGETS) {
    const existing = existingDictionaries[target] ?? {};
    const missing = strings.filter((value) => !Object.hasOwn(existing, value));
    console.log(`Translating ${missing.length} missing UI strings to ${target}...`);
    const translations = await mapWithConcurrency(missing, 8, (value) => translate(value, target));
    existingDictionaries[target] = {
      ...existing,
      ...Object.fromEntries(missing.map((value, index) => [value, translations[index]])),
      ...CURATED_TRANSLATIONS[target]
    };
  }

  const output = `// Generated by scripts/generate-ui-translations.mjs.\n` +
    `// Keep this file committed so UI translation never depends on a runtime API key.\n` +
    `export const generatedUiTranslations = ${JSON.stringify(existingDictionaries, null, 2)} as const;\n`;
  fs.writeFileSync(OUTPUT, output, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}.`);
  process.exit(0);
}

if (process.argv.includes("--count")) {
  console.log(strings.length);
  process.exit(0);
}

for (const target of TARGETS) {
  console.log(`Translating ${strings.length} UI strings to ${target}...`);
  const translations = await mapWithConcurrency(strings, 8, (value) => translate(value, target));
  dictionaries[target] = {
    ...Object.fromEntries(strings.map((value, index) => [value, translations[index]])),
    ...CURATED_TRANSLATIONS[target]
  };
}

const output = `// Generated by scripts/generate-ui-translations.mjs.\n` +
  `// Keep this file committed so UI translation never depends on a runtime API key.\n` +
  `export const generatedUiTranslations = ${JSON.stringify(dictionaries, null, 2)} as const;\n`;

fs.writeFileSync(OUTPUT, output, "utf8");
console.log(`Wrote ${path.relative(ROOT, OUTPUT)}.`);
