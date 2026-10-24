import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGaanaCatalog } from '../api/gaana-catalog.js';

async function call(path, query = '', method = 'GET') {
  let response;
  const raw = new URL('http://localhost' + path + query);
  const handled = await handleGaanaCatalog({ method }, {}, {
    path, raw,
    send: (_res, code, body) => { response = { code, body }; },
    rate: () => true
  });
  return { handled, response };
}

test('unrelated catalog routes do not intercept the website', async () => {
  const r = await call('/api/music/status');
  assert.equal(r.handled, false);
});

test('invalid query is rejected without upstream access', async () => {
  const r = await call('/api/catalog/gaana/search', '?q=a');
  assert.equal(r.response.code, 400);
});

test('valid catalog metadata can be read without enabling playback', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    gr: [{ gd: [{ seo: 'a-safe-test-song', track_title: 'Test title', artist_name: 'Test artist' }] }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const r = await call('/api/catalog/gaana/search', '?q=test');
    assert.equal(r.response.code, 200);
    assert.equal(r.response.body.count, 1);
    assert.equal(r.response.body.tracks[0].playable, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('HTML upstream errors fail closed instead of showing broken tracks', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>Unavailable</html>', {
    status: 200, headers: { 'content-type': 'text/html' }
  });
  try {
    const r = await call('/api/catalog/gaana/status');
    assert.equal(r.response.code, 503);
    assert.equal(r.response.body.playable, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('405 on POST retries standard GET before giving up', async () => {
  const originalFetch = globalThis.fetch;
  const methods = [];
  globalThis.fetch = async (_url, options) => {
    methods.push(options.method);
    return options.method === 'POST'
      ? new Response('Method Not Allowed', { status: 405 })
      : new Response(JSON.stringify({ gr: [{ gd: [{ seo: 'indie-song', track_title: 'Indie Song' }] }] }), {
          headers: { 'content-type': 'application/json' }
        });
  };
  try {
    const r = await call('/api/catalog/gaana/search', '?q=indie');
    assert.equal(r.response.code, 200);
    assert.deepEqual(methods, ['POST', 'GET']);
  } finally { globalThis.fetch = originalFetch; }
});
