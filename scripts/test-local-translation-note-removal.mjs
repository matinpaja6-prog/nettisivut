import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url), {chromium} = require('playwright');
const base = process.env.MASKINES_TEST_URL || 'http://localhost:3000';
const out = new URL('../output/site-audit-2026-09-03/', import.meta.url);
const source = await readFile(new URL('../app/listing/[id]/ListingPageClient.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(source, /ListingTranslationNote|listing-translation-note/);
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const context = await browser.newContext({viewport: {width: 1440, height: 960}});
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url());
  if (/google-analytics|googletagmanager/.test(url.hostname)) return route.abort();
  if (!['GET','HEAD','OPTIONS'].includes(request.method()) && url.pathname !== '/rest/v1/rpc/maskines_search_listings') return route.abort();
  return route.continue();
});
const page = await context.newPage(), results = [], errors = [];
page.setDefaultTimeout(20000);
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(base + '/evasteet');
  await page.getByRole('button', {name: 'Vain välttämättömät', exact: true}).click();
  for (const locale of ['fi', 'en', 'sv', 'no']) {
    const prefix = locale === 'fi' ? '' : '/' + locale;
    for (const path of ['/ski-doo/mxz-rs/polttoainesailiot-tankit/165', '/polaris/rmk/128']) {
      await page.goto(base + prefix + path);
      await page.locator('.listing-section-content > p').first().waitFor();
      for (const theme of ['light', 'dark']) {
        await page.locator('.utility-theme-switcher').click();
        const names = {fi: ['Vaalea','Tumma'], en: ['Light','Dark'], sv: ['Ljust','Mörkt'], no: ['Lyst','Mørkt']};
        await page.getByRole('option', {name: names[locale][theme === 'light' ? 0 : 1], exact: true}).click();
        for (const width of [1440, 390]) {
          await page.setViewportSize({width, height: 960});
          assert.equal(await page.locator('.listing-translation-note').count(), 0);
          assert.equal(await page.locator('main a[href^="mailto:info@maskines.com?subject=Maskines"]').count(), 0);
          const description = await page.locator('.listing-section-content > p').first().innerText();
          assert.ok(description.length > 5, 'The description itself must remain');
          if (locale === 'en') assert.doesNotMatch(await page.locator('main').innerText(), /The translation may be partial|Show original listing|Report a translation error/);
          if (locale === 'en' && path.endsWith('/165')) {
            await page.locator('.description-card.listing-facts-card').screenshot({path: fileURLToPath(new URL(`description-${theme}-${width}.png`, out))});
          }
          results.push({locale, path, theme, width, noteAbsent: true, descriptionPresent: true});
        }
      }
      console.log(`PASS ${locale} ${path}: no translation box in either theme or viewport; description remains`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(new URL('translation-note-removal-tests.json', out), JSON.stringify({base, results, errors}, null, 2));
  await context.close();
  await browser.close();
}
