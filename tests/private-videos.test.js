import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePrivateVideoRequest } from '../cloudflare/private-videos.js';

const firstUser = '0b8fde5b-530b-4016-8c39-ac6c9eeed46f';
const otherUser = 'f1c1cb6b-87ce-4eaf-a365-a0a20b035f9e';
const text = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const call = (path, method = 'GET', headers = {}, body) => new Request('https://rhymeorbit.in' + path, { method, headers, body });

function fixture(t) {
  const objects = new Map();
  const bucket = {
    async put(key, stream, opts = {}) {
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      objects.set(key, { bytes, metadata: opts.customMetadata, type: opts.httpMetadata?.contentType, uploaded: new Date() });
    },
    async head(key) { const row = objects.get(key); return row ? { size: row.bytes.byteLength } : null; },
    async get(key, opts) {
      const row = objects.get(key);if (!row) return null;
      const start = opts?.range?.offset || 0, end = start + (opts?.range?.length || row.bytes.length);
      return { body: new Blob([row.bytes.slice(start, end)]).stream() };
    },
    async list({ prefix }) {
      return { objects: [...objects.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, row]) => ({
        key, size: row.bytes.byteLength, uploaded: row.uploaded, customMetadata: row.metadata
      })), truncated: false };
    },
    async delete(key) { objects.delete(key); }
  };
  const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'publishable-key', SONGS_BUCKET: bucket };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).pathname, '/auth/v1/user');
    const token = init.headers.authorization;
    if (token === 'Bearer a') return text({ id: firstUser, email_confirmed_at: '2026-01-01' });
    if (token === 'Bearer b') return text({ id: otherUser, email_confirmed_at: '2026-01-01' });
    if (token === 'Bearer unverified') return text({ id: firstUser, email_confirmed_at: null });
    return text({ error: 'No' }, 401);
  });
  return { env, objects };
}

test('Non-video routes fall through to the existing backend', async () => {
  assert.equal(await handlePrivateVideoRequest(call('/api/health'), {}), null);
});

test('Private video uploads require a verified user and reject oversized objects', async t => {
  const { env, objects } = fixture(t);
  const payload = new Blob(['this is a private video'.repeat(100)], { type: 'video/webm' });
  const headers = { 'content-type': 'video/webm', 'content-length': String(payload.size), 'x-video-title': 'My Song', 'x-video-duration': '50' };
  assert.equal((await handlePrivateVideoRequest(call('/api/videos/upload', 'POST', headers, payload), env)).status, 401);
  assert.equal((await handlePrivateVideoRequest(call('/api/videos/upload', 'POST', { ...headers, authorization: 'Bearer unverified' }, payload), env)).status, 401);
  assert.equal(objects.size, 0);
  assert.equal((await handlePrivateVideoRequest(call('/api/videos/upload', 'POST', { ...headers, authorization: 'Bearer a', 'content-length': String(51 * 1024 * 1024) }, payload), env)).status, 413);
  assert.equal(objects.size, 0);
});

test('Video is stored privately in R2, listed only by owner, supports ranges and deletion', async t => {
  const { env, objects } = fixture(t);
  const payload = new Blob(['y'.repeat(2400)], { type: 'video/mp4' });
  const uploaded = await handlePrivateVideoRequest(call('/api/videos/upload', 'POST', {
    authorization: 'Bearer a', 'content-type': 'video/mp4', 'content-length': String(payload.size),
    'x-video-title': 'My Finished Video', 'x-video-duration': '120'
  }, payload), env);
  assert.equal(uploaded.status, 201);
  const info = await uploaded.json();
  assert.match(info.url, /^\/api\/videos\/file\/[a-f0-9-]+\.mp4$/);
  assert.equal(objects.size, 1);
  assert.ok([...objects.keys()][0].startsWith('videos/' + firstUser + '/'));
  const myList = await (await handlePrivateVideoRequest(call('/api/videos', 'GET', { authorization: 'Bearer a' }), env)).json();
  assert.equal(myList.items.length, 1);
  assert.equal(myList.items[0].duration, 120);
  assert.equal(myList.items[0].title, 'My Finished Video');
  const strangers = await (await handlePrivateVideoRequest(call('/api/videos', 'GET', { authorization: 'Bearer b' }), env)).json();
  assert.equal(strangers.items.length, 0);
  const blocked = await handlePrivateVideoRequest(call(info.url, 'GET', { authorization: 'Bearer b' }), env);
  assert.equal(blocked.status, 404);
  const range = await handlePrivateVideoRequest(call(info.url, 'GET', { authorization: 'Bearer a', range: 'bytes=10-20' }), env);
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), 'bytes 10-20/2400');
  assert.equal((await range.arrayBuffer()).byteLength, 11);
  const removal = await handlePrivateVideoRequest(call('/api/videos/delete', 'POST', { authorization: 'Bearer a', 'content-type': 'application/json' }, JSON.stringify({ id: info.id, format: 'mp4' })), env);
  assert.equal(removal.status, 200);
  assert.equal(objects.size, 0);
});
