import test from 'node:test';
import assert from 'node:assert/strict';
import * as admin from '../functions/admin/api/gear.js';
import { onRequestGet as publicGet } from '../functions/api/gear.js';
import { parseEstimatedValue, gearValueSummary } from '../functions/_shared/gear-value.js';

const request = (method, estimatedValue, id = '') => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ id, name: 'Camera', category: 'Camera', owner: 'Jet Sullivan & Ben Stapleton', rating: '5', description: 'Camera body', kitParts: '', imageAlt: '', estimatedValue })) {
    if (value !== undefined) form.set(key, value);
  }
  if (method === 'POST') form.set('image', new File(['image'], 'camera.png', { type: 'image/png' }));
  return new Request('https://site.test/admin/api/gear', { method, body: form });
};

test('values persist through create, edit and list; public API exposes only the combined estimate', async () => {
  const items = new Map();
  const env = {
    CONTENT_KV: {
      get: async key => items.has(key) ? JSON.parse(items.get(key)) : null,
      put: async (key, value) => items.set(key, value),
      delete: async key => items.delete(key),
      list: async () => ({ keys: [...items.keys()].map(name => ({ name })), list_complete: true }),
    },
    MEDIA_BUCKET: { put: async () => {} },
  };
  const created = await admin.onRequestPost({ env, request: request('POST', '1250.25') });
  assert.equal(created.status, 201);
  const { item } = await created.json();
  assert.equal(item.estimatedValue, 1250.25);
  const second = await admin.onRequestPost({ env, request: request('POST', '49.85') });
  assert.equal(second.status, 201);
  const legacy = await admin.onRequestPost({ env, request: request('POST', undefined) });
  assert.equal(legacy.status, 201);
  const publicData = await (await publicGet({ env })).json();
  assert.deepEqual(publicData.summary, { totalValue: 1300.1, valuedItemCount: 2, itemCount: 3, currency: 'USD' });
  assert.ok(publicData.items.every(item => !Object.hasOwn(item, 'estimatedValue')));
  const edited = await admin.onRequestPut({ env, request: request('PUT', '999.99', item.id) });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).item.estimatedValue, 999.99);
  const listed = await (await admin.onRequestGet({ env })).json();
  assert.equal(listed.items.find(row => row.id === item.id).estimatedValue, 999.99);
  const invalid = await admin.onRequestPut({ env, request: request('PUT', '-1', item.id) });
  assert.equal(invalid.status, 400);
  await admin.onRequestPut({ env, request: request('PUT', '', item.id) });
  assert.equal((await (await publicGet({ env })).json()).summary.totalValue, 49.85);
  await admin.onRequestDelete({ env, request: new Request(`https://site.test/admin/api/gear?id=${(await second.json()).item.id}`, { method: 'DELETE' }) });
  assert.equal((await (await publicGet({ env })).json()).summary.totalValue, 0);
});

test('optional values, zero, decimals and invalid inputs', () => {
  for (const value of ['', '  ', undefined, null]) assert.equal(parseEstimatedValue(value), null);
  assert.equal(parseEstimatedValue('0'), 0);
  assert.equal(parseEstimatedValue('12.34'), 12.34);
  for (const value of ['-1', 'Infinity', 'NaN', 'abc', '0.001', '1000000000', '1e3']) assert.throws(() => parseEstimatedValue(value));
  assert.deepEqual(gearValueSummary([{ estimatedValue: 0.1 }, { estimatedValue: 0.2 }, { estimatedValue: 0 }, {}, { estimatedValue: -5 }]), { totalValue: 0.3, valuedItemCount: 3, itemCount: 5, currency: 'USD' });
});
