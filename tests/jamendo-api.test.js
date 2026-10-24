import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../api/index.js';
import { normalizeJamendoTrack } from '../api/jamendo.js';
import { readFileSync } from 'node:fs';

async function request(path) {
  let status, data;
  const req = {
    method: 'GET', url: path, headers: { 'x-forwarded-for': '198.51.100.48' },
    socket: { remoteAddress: '198.51.100.48' }
  };
  await handleApi(req, {
    writeHead(code) { status = code; },
    end(value) { data = JSON.parse(value); }
  });
  return { status, data };
}

const track = (extras = {}) => ({
  id: 45678, name: 'A safe indie track', artist_name: 'Original Artist',
  duration: 178, image: 'https://usercontent.jamendo.com/cover.jpg',
  audio: 'https://prod-1.storage.jamendo.com/?trackid=45678&format=mp31',
  license_ccurl: 'http://creativecommons.org/licenses/by/4.0/',
  ...extras
});

test('Jamendo catalog is available with Client ID, and supports emergency disabling', async () => {
  const old = Object.fromEntries(['JAMENDO_CLIENT_ID', 'JAMENDO_CLIENT_SECRET', 'JAMENDO_CATALOG_DISABLED'].map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  process.env.JAMENDO_CLIENT_ID = 'test-client-123';
  process.env.JAMENDO_CLIENT_SECRET = 'never-expose-this';
  process.env.JAMENDO_CATALOG_DISABLED = 'true';
  globalThis.fetch = async () => { throw Error('No provider request allowed when the catalog is disabled'); };
  try {
    const status = await request('/api/jamendo/status');
    assert.equal(status.status, 200);
    assert.equal(status.data.configured, true);
    assert.equal(status.data.publicCatalogEnabled, false);
    assert.doesNotMatch(JSON.stringify(status.data), /test-client-123|never-expose-this/);
    const search = await request('/api/jamendo/search?q=love');
    assert.equal(search.status, 503);
    assert.match(search.data.error, /disabled/i);
    delete process.env.JAMENDO_CATALOG_DISABLED;
    assert.equal((await request('/api/jamendo/status')).data.publicCatalogEnabled, true);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

test('Jamendo licensed lookup uses Client ID only and returns safe, credited results', async () => {
  const keys = ['JAMENDO_CLIENT_ID', 'JAMENDO_CLIENT_SECRET', 'JAMENDO_CATALOG_DISABLED'];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    JAMENDO_CLIENT_ID: 'client-abc-123',
    JAMENDO_CLIENT_SECRET: 'never-send-secret',
    JAMENDO_CATALOG_DISABLED: 'false'
  });
  let upstreamCalls = 0;
  globalThis.fetch = async url => {
    upstreamCalls++;
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.jamendo.com');
    assert.equal(parsed.searchParams.get('client_id'), 'client-abc-123');
    assert.equal(parsed.searchParams.get('search'), 'romantic indie');
    assert.equal(parsed.searchParams.get('limit'), '30');
    assert.equal(parsed.searchParams.get('offset'), '30');
    assert.equal(parsed.searchParams.get('ccnc'), 'false');
    assert.equal(parsed.searchParams.get('ccnd'), 'false');
    assert.equal(parsed.href.includes('never-send-secret'), false);
    return { ok: true, async json() { return { headers: { status: 'success' }, results: [
      track(),
      track({ id: 45679, license_ccurl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' }),
      track({ id: 45680, audio: 'https://attacker.invalid/steal' }),
      track({ id: 45681, license_ccurl: 'https://creativecommons.org/licenses/by-nd/4.0/' })
    ] }; } };
  };
  try {
    const result = await request('/api/jamendo/search?q=romantic%20indie&offset=30');
    assert.equal(result.status, 200);
    assert.equal(upstreamCalls, 1);
    assert.equal(result.data.items.length, 1);
    assert.equal(result.data.hasMore, false);
    assert.equal(result.data.nextOffset, 60);
    assert.equal(result.data.items[0].title, 'A safe indie track');
    assert.equal(result.data.items[0].source, 'https://www.jamendo.com/track/45678');
    assert.equal(result.data.items[0].license, 'https://creativecommons.org/licenses/by/4.0/');
    assert.equal(result.data.items[0].audio.startsWith('https://prod-1.storage.jamendo.com/'), true);
    assert.ok(!JSON.stringify(result.data).includes('never-send-secret'));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

test('Jamendo validates query, licensing metadata and does not enable karaoke recording', async () => {
  assert.equal(normalizeJamendoTrack(track({ license_ccurl: 'https://creativecommons.org/licenses/by-sa/4.0/' }))?.artist, 'Original Artist');
  assert.equal(normalizeJamendoTrack(track({ audio: 'http://prod-1.storage.jamendo.com/track.mp3' })), null);
  assert.equal(normalizeJamendoTrack(track({ license_ccurl: 'https://creativecommons.org/licenses/by-nc/4.0/' })), null);
  assert.equal(normalizeJamendoTrack(track({ id: '<script>alert(1)</script>' })), null);
  const old = { id: process.env.JAMENDO_CLIENT_ID, disabled: process.env.JAMENDO_CATALOG_DISABLED };
  process.env.JAMENDO_CLIENT_ID = 'client-abc-123';
  process.env.JAMENDO_CATALOG_DISABLED = 'false';
  try {
    const invalid = await request('/api/jamendo/search?q=a');
    assert.equal(invalid.status, 400);
    const invalidPage = await request('/api/jamendo/search?q=rock&offset=999999');
    assert.equal(invalidPage.status, 400);
    const frontend = readFileSync(new URL('../public/jamendo-indie.js', import.meta.url), 'utf8');
    assert.match(frontend, /publicCatalogEnabled/);
    assert.match(frontend, /roYtForm/);
    assert.match(frontend, /insertBefore\(section, mainResults\)/);
    assert.match(frontend, /searchJamendo\('rock'\)/);
    assert.match(frontend, /Acoustic/);
    assert.match(frontend, /roJamendoMore/);
    assert.match(frontend, /DOMContentLoaded/);
    assert.doesNotMatch(frontend, /client_secret|JAMENDO_CLIENT_SECRET|karaoke\.start\(/);
  } finally {
    old.id === undefined ? delete process.env.JAMENDO_CLIENT_ID : process.env.JAMENDO_CLIENT_ID = old.id;
    old.disabled === undefined ? delete process.env.JAMENDO_CATALOG_DISABLED : process.env.JAMENDO_CATALOG_DISABLED = old.disabled;
  }
});
