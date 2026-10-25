import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAudiusCatalog, normalizeAudiusTrack } from '../api/audius.js';

async function call(path, method = 'GET') {
  let result;
  const handled = await handleAudiusCatalog({ method }, {}, {
    path: new URL('http://localhost' + path).pathname,
    raw: new URL('http://localhost' + path),
    send: (_res, status, body) => { result = { status, body }; },
    rate: () => true
  });
  return { handled, ...result };
}

const sample = extras => ({
  id: 'NvXwOB4', title: 'Hindi independent song',
  user: { name: 'Community creator' },
  duration: 180, is_available: true, is_streamable: true,
  permalink: '/community-creator/hindi-independent-song',
  ...extras
});

test('public Audius catalog only handles its own read-only route', async () => {
  assert.equal((await call('/api/jamendo/status')).handled, false);
  assert.equal((await call('/api/catalog/audius/search?q=a')).status, 400);
  assert.equal((await call('/api/catalog/audius/search?q=hindi', 'POST')).status, 405);
  assert.equal((await call('/api/catalog/audius/delete?q=hindi')).status, 404);
});

test('free search sends no credentials, validates track IDs and returns official stream routes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const target = new URL(url);
    assert.equal(target.origin, 'https://api.audius.co');
    assert.equal(target.pathname, '/v1/tracks/search');
    assert.equal(target.searchParams.get('query'), 'Kesariya');
    assert.equal(target.searchParams.get('limit'), '12');
    assert.equal(opts.headers.Authorization, undefined);
    return new Response(JSON.stringify({ data: [
      sample({ title: 'Kesariya' }),
      sample({ id: '../bad', title: 'Invalid ID' }),
      sample({ id: 'unplayable', is_streamable: false }),
      sample({ id: 'unavailable', is_available: false })
    ] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const response = await call('/api/catalog/audius/search?q=Kesariya');
    assert.equal(response.status, 200);
    assert.equal(response.body.count, 1);
    const track = response.body.tracks[0];
    assert.equal(track.audio, 'https://api.audius.co/v1/tracks/NvXwOB4/stream');
    assert.equal(track.source, 'https://audius.co/community-creator/hindi-independent-song');
    assert.equal(track.verifiedOriginal, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('upstream HTML and network errors fail with an honest unavailable status', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<html>blocked</html>', { headers: { 'content-type': 'text/html' } });
    assert.equal((await call('/api/catalog/audius/search?q=music')).status, 503);
    globalThis.fetch = async () => { throw new Error('network down'); };
    assert.equal((await call('/api/catalog/audius/search?q=music')).status, 503);
  } finally { globalThis.fetch = originalFetch; }
});

test('normalization never trusts arbitrary upstream audio or source URLs', () => {
  const item = normalizeAudiusTrack(sample({
    audio: 'https://attacker.invalid/x',
    permalink: 'https://attacker.invalid/song',
    user: { name: '<script>hello</script>' }
  }));
  assert.equal(item.audio, 'https://api.audius.co/v1/tracks/NvXwOB4/stream');
  assert.equal(item.source, 'https://audius.co');
  assert.ok(item.artist.includes('<script>')); // frontend uses textContent, never HTML.
});
