// Browser-only, signed-out localhost regression. Never writes to the app or DB.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createTestLoader } from './test-module-loader.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = new URL(process.env.MASKINES_TEST_URL || 'http://localhost:3000');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Localhost only');
const browser = await chromium.launch({ headless: true, channel: process.env.MASKINES_BROWSER_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url());
  if (/google-analytics|googletagmanager/.test(url.hostname)) return route.abort();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && (url.origin === base.origin || url.hostname.endsWith('.supabase.co'))) return route.abort();
  return route.continue();
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const preview = page.locator('[data-listing-image-preview]');
const open = () => page.getByRole('button', { name: 'Avaa kuva suurempana', exact: true }).first().click();
const close = () => page.getByRole('button', { name: 'Sulje kuvan esikatselu', exact: true }).click();
const gone = () => preview.waitFor({ state: 'detached' });
async function checkLayout(theme) {
  await preview.locator('img').evaluate(img => img.decode());
  const result = await preview.evaluate(dialog => {
    const image = dialog.querySelector('img'), button = dialog.querySelector('button');
    return { modal: dialog.matches(':modal'), rect: dialog.getBoundingClientRect().toJSON(), image: image.getBoundingClientRect().toJSON(), natural: [image.naturalWidth, image.naturalHeight], fit: getComputedStyle(image).objectFit, close: button.getBoundingClientRect().toJSON(), background: getComputedStyle(dialog).backgroundColor, viewport: [innerWidth, innerHeight], scrollLocked: document.body.style.overflow === 'hidden' && document.documentElement.style.overflow === 'hidden' };
  });
  assert.equal(result.modal, true, 'Native top layer prevents header/chat overlap');
  assert.equal(result.scrollLocked, true);
  assert.equal(result.fit, 'contain');
  for (const rect of [result.rect, result.image, result.close]) {
    assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= result.viewport[0] && rect.bottom <= result.viewport[1], 'Preview, image and close button must fit viewport');
  }
  assert.ok(Math.abs(result.image.width / result.image.height - result.natural[0] / result.natural[1]) < 0.005, 'Do not stretch or crop photo');
  assert.ok(result.close.width >= 44 && result.close.height >= 44, 'Accessible close target');
  assert.equal(result.background, theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(16, 29, 41)');
  console.log(`PASS ${theme} ${result.viewport.join('x')}: top layer, image ratio, viewport bounds, visible close and scroll lock`);
}
try {
  await page.goto(new URL('/evasteet', base).href);
  await page.waitForFunction(() => document.documentElement.dataset.maskinesMeasurement);
  await page.getByRole('button', { name: 'Vain välttämättömät', exact: true }).click();
  await page.goto(new URL('/ski-doo/mxz-rs/polttoainesailiot-tankit/165', base).href);
  await page.getByRole('button', { name: 'Väriteema', exact: true }).click();
  await page.getByRole('option', { name: 'Vaalea', exact: true }).click();
  for (const [width, height] of [[1280, 720], [1920, 1080], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const previousOverflow = await page.evaluate(() => ({ root: document.documentElement.style.overflow, body: document.body.style.overflow }));
    await open();
    await checkLayout('light');
    if (width === 1920 || width === 390) {
      await mkdir(new URL('../output/ui/', import.meta.url), { recursive: true });
      await page.screenshot({ path: fileURLToPath(new URL(`../output/ui/listing-preview-light-${width}.png`, import.meta.url)) });
    }
    // Tab stays in the modal even when the page has many focusable elements.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focus = await preview.evaluate(dialog => ({ inside: dialog.contains(document.activeElement), tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label') }));
    // Chrome can tab into browser chrome, represented by BODY as activeElement;
    // no focusable background-page control may receive focus while modal.
    assert.ok(focus.inside || focus.tag === 'BODY', JSON.stringify(focus));
    await preview.getByRole('button', { name: 'Sulje kuvan esikatselu', exact: true }).focus();
    await page.keyboard.press('Escape');
    await gone();
    assert.deepEqual(await page.evaluate(() => ({ root: document.documentElement.style.overflow, body: document.body.style.overflow })), previousOverflow);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Avaa kuva suurempana');
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(); await close(); await gone();
  await open(); await page.mouse.click(2, 2); await gone();
  console.log('PASS close button, Escape, backdrop, focus trap/restoration and scroll restoration');
  await page.getByRole('button', { name: 'Väriteema', exact: true }).click();
  await page.getByRole('option', { name: 'Tumma', exact: true }).click();
  for (const [width, height] of [[1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await open(); await checkLayout('dark'); await close(); await gone();
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  // Discover a real public gallery instead of assuming numeric URL aliases.
  createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(process.cwd());
  const db = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(db && key, 'Public catalogue configuration required');
  const params = new URLSearchParams({ select: 'id,listing_number,brand,model,category,subcategory,image_url,image_urls', is_hidden: 'eq.false', is_sold: 'eq.false', limit: '100' });
  const response = await fetch(`${db}/rest/v1/listings?${params}`, { method: 'GET', headers: { apikey: key }, signal: AbortSignal.timeout(20000) });
  assert.ok(response.ok, 'Public gallery discovery must succeed');
  const candidates = (await response.json()).filter(row => new Set([row.image_url, ...(row.image_urls || [])].filter(Boolean)).size > 1).slice(0, 3);
  const { listingPath } = createTestLoader()('lib/routes.ts');
  let testedGallery = false;
  for (const listing of candidates) {
    const path = listingPath(listing, 'fi');
    await page.goto(new URL(path, base).href);
    const thumbnails = page.getByRole('button', { name: /^Kuva \d+\/\d+$/ });
    await thumbnails.first().waitFor({ timeout: 20000 });
    if (await thumbnails.count() < 2) continue;
    await open();
    const first = await preview.locator('img').getAttribute('src');
    await preview.getByRole('button', { name: 'Seuraava kuva', exact: true }).click();
    await page.waitForFunction(src => document.querySelector('[data-listing-image-preview] img')?.getAttribute('src') !== src, first);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(src => document.querySelector('[data-listing-image-preview] img')?.getAttribute('src') === src, first);
    await close(); await gone();
    testedGallery = true;
    console.log(`PASS multi-image listing ${path}: next button and left arrow preserve gallery navigation`);
    break;
  }
  assert.equal(testedGallery, true, 'Need at least one public multi-image listing for navigation regression');
  assert.deepEqual(errors, [], 'No browser runtime errors');
} finally { await context.close(); await browser.close(); }
