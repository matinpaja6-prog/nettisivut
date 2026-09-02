import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTestLoader } from './test-module-loader.mjs';
const { listingTitleDetailFacts } = createTestLoader()('lib/listing-title-facts.ts');
const labels = { category: 'Kategoria', mileage: 'Ajokilometrit', operatingHours: 'Käyttötunnit', notSpecified: 'Ei ilmoitettu' };
const vehicle = { isVehicle: true, category: 'Moottorikelkka', mileage: '', operatingHours: '' };
const plain = value => JSON.parse(JSON.stringify(value));
const result = values => plain(listingTitleDetailFacts({ ...vehicle, ...values }, labels));
assert.deepEqual(result({ mileage: '3 500 km' }), [{ label: 'Ajokilometrit', value: '3 500 km' }]);
assert.deepEqual(result({ operatingHours: '120 h' }), [{ label: 'Käyttötunnit', value: '120 h' }]);
assert.deepEqual(result({ mileage: '0 km' }), [{ label: 'Ajokilometrit', value: '0 km' }]);
assert.deepEqual(result({ operatingHours: '0 h' }), [{ label: 'Käyttötunnit', value: '0 h' }]);
assert.deepEqual(result({ mileage: '2 500 km', operatingHours: '150 h' }), [
  { label: 'Ajokilometrit', value: '2 500 km' }, { label: 'Käyttötunnit', value: '150 h' }
]);
assert.deepEqual(result({}), [{ label: 'Kategoria', value: 'Moottorikelkka' }]);
assert.deepEqual(result({ mileage: '  ', operatingHours: '\n' }), [{ label: 'Kategoria', value: 'Moottorikelkka' }]);
assert.deepEqual(result({ category: '' }), [{ label: 'Kategoria', value: 'Ei ilmoitettu' }]);
assert.deepEqual(result({ isVehicle: false, category: 'Moottori', mileage: '2 500 km', operatingHours: '150 h' }), [{ label: 'Kategoria', value: 'Moottori' }]);
const english = { category: 'Category', mileage: 'Mileage', operatingHours: 'Operating hours', notSpecified: 'Not specified' };
assert.deepEqual(plain(listingTitleDetailFacts({ ...vehicle, mileage: '100 km' }, english)), [{ label: 'Mileage', value: '100 km' }]);
const page = readFileSync(new URL('../app/listing/[id]/ListingPageClient.tsx', import.meta.url), 'utf8');
assert.match(page, /isVehicle: listingIsVehicle/);
assert.match(page, /mileage: formattedVehicleMileage/);
assert.match(page, /operatingHours: formattedVehicleHours/);
assert.match(page, /titleDetailFacts\.map/);
console.log('PASS listing title facts: km, hours, both, zero, missing, part listings and localized labels');
