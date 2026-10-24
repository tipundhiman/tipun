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

test('New private video uploads are disabled; older private videos are preserved', async t => {
  const { env, objects } = fixture(t);
  const payload = new Blob(['this is a private video'.repeat(100)], { type: 'video/webm' });
  const headers = { 'content-type': 'video/webm', 'content-length': String(payload.size), 'x-video-title': 'My Song', 'x-video-duration': '50' };
  assert.equal((await handlePrivateVideoRequest(call('/api/videos/upload', 'POST', headers, payload), env)).status, 401);
  assert.equal((await handlePrivateVideoRequest(call('/api/videos/upload', 'POST', { ...headers, authorization: 'Bearer unverified' }, payload), env)).status, 401);
  assert.equal(objects.size, 0);
  const blocked = await handlePrivateVideoRequest(call('/api/videos/upload', 'POST', { ...headers, authorization: 'Bearer a', 'content-length': String(51 * 1024 * 1024) }, payload), env);
  assert.equal(blocked.status, 410);
  assert.match((await blocked.json()).error, /Download/);
  assert.equal(objects.size, 0);
});

test('Earlier R2 videos remain owner-only, readable by range, and deletable', async t => {
  const { env, objects } = fixture(t);
  const id = '3e859cad-871d-45d7-8483-c9ac0e868634';
  const url = '/api/videos/file/' + id + '.mp4';
  objects.set('videos/' + firstUser + '/' + id + '.mp4', {
    bytes: new Uint8Array(2400).fill(121), metadata: { title: 'My Finished Video', duration: '120' },
    type: 'video/mp4', uploaded: new Date()
  });
  assert.equal(objects.size, 1);
  assert.ok([...objects.keys()][0].startsWith('videos/' + firstUser + '/'));
  const myList = await (await handlePrivateVideoRequest(call('/api/videos', 'GET', { authorization: 'Bearer a' }), env)).json();
  assert.equal(myList.items.length, 1);
  assert.equal(myList.items[0].duration, 120);
  assert.equal(myList.items[0].title, 'My Finished Video');
  const strangers = await (await handlePrivateVideoRequest(call('/api/videos', 'GET', { authorization: 'Bearer b' }), env)).json();
  assert.equal(strangers.items.length, 0);
  const blocked = await handlePrivateVideoRequest(call(url, 'GET', { authorization: 'Bearer b' }), env);
  assert.equal(blocked.status, 404);
  const range = await handlePrivateVideoRequest(call(url, 'GET', { authorization: 'Bearer a', range: 'bytes=10-20' }), env);
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), 'bytes 10-20/2400');
  assert.equal((await range.arrayBuffer()).byteLength, 11);
  const removal = await handlePrivateVideoRequest(call('/api/videos/delete', 'POST', { authorization: 'Bearer a', 'content-type': 'application/json' }, JSON.stringify({ id, format: 'mp4' })), env);
  assert.equal(removal.status, 200);
  assert.equal(objects.size, 0);
});

test('No-content-length browser uploads are also disabled', async t => {
  const { env, objects } = fixture(t);
  const payload = new Blob(['z'.repeat(3200)], { type: 'video/webm' });
  const upload = await handlePrivateVideoRequest(call('/api/videos/upload', 'POST', {
    authorization: 'Bearer a', 'content-type': 'video/webm',
    'x-video-title': 'Chrome export', 'x-video-duration': '30'
  }, payload), env);
  assert.equal(upload.status, 410);
  assert.equal(objects.size, 0);
});
