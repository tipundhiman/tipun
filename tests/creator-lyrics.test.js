import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCreatorLyricsRequest } from '../cloudflare/creator-lyrics.js';

const userA = '0b8fde5b-530b-4016-8c39-ac6c9eeed46f';
const userB = 'f1c1cb6b-87ce-4eaf-a365-a0a20b035f9e';
const response = (data, status = 200) => Response.json(data, { status });
const req = (path, method = 'GET', token = 'a', body, contentType = 'application/json') => new Request('https://rhymeorbit.in' + path, {
  method, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), 'content-type': contentType }, body
});
function setup(t) {
  const files = new Map(), calls = [];
  const bucket = {
    async put(key, input) { files.set(key, new Blob([input])); },
    async get(key) { const b = files.get(key); return b && { size: b.size, text: () => b.text() }; }
  };
  const env = { SONGS_BUCKET: bucket, SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_ANON_KEY: 'public',
    SUPABASE_SERVICE_ROLE_KEY: 'secret', GEMINI_API_KEY: 'fake-key' };
  t.mock.method(globalThis, 'fetch', async (url, opts = {}) => {
    const path = new URL(url).pathname; calls.push(path);
    if (path === '/auth/v1/user') {
      if (opts.headers.authorization === 'Bearer a') return response({ id: userA, email_confirmed_at: '2026-01-01' });
      if (opts.headers.authorization === 'Bearer b') return response({ id: userB, email_confirmed_at: '2026-01-01' });
      return response({ error: 'Unauthorized' }, 401);
    }
    if (path === '/rest/v1/generated_songs') return response(new URL(url).searchParams.get('user_id') === 'eq.' + userA ? [{ task_id: 'song-123' }] : []);
    if (path.endsWith(':generateContent')) {
      const content = JSON.parse(opts.body);
      assert.ok(content.contents[0].parts[1].inline_data.data.length > 100);
      return response({ candidates: [{ content: { parts: [{ text: 'Aaj phir se dil gaa raha hai\n[unclear]' }] } }] });
    }
    throw Error('Unexpected test API: ' + url);
  });
  return { env, files, calls };
}

test('Private lyrics belong to the owner and survive R2 save/reload', async t => {
  const { env, files } = setup(t);
  const empty = await (await handleCreatorLyricsRequest(req('/api/music/lyrics?taskId=song-123'), env)).json();
  assert.equal(empty.saved, false);
  const saved = await handleCreatorLyricsRequest(req('/api/music/lyrics', 'POST', 'a', JSON.stringify({ taskId: 'song-123', lyrics: 'Dil se mere, song' })), env);
  assert.equal(saved.status, 200);
  assert.ok(files.has('song-lyrics/' + userA + '/song-123.json'));
  const loaded = await (await handleCreatorLyricsRequest(req('/api/music/lyrics?taskId=song-123'), env)).json();
  assert.equal(loaded.lyrics, 'Dil se mere, song');
  assert.equal((await handleCreatorLyricsRequest(req('/api/music/lyrics?taskId=song-123', 'GET', 'b'), env)).status, 404);
  assert.equal((await handleCreatorLyricsRequest(req('/api/music/lyrics?taskId=song-123', 'GET', ''), env)).status, 401);
  assert.equal((await handleCreatorLyricsRequest(req('/api/music/lyrics?taskId=..%2Fother'), env)).status, 400);
});

test('Audio is transcribed only after verified login and is not stored in R2', async t => {
  const { env, files, calls } = setup(t);
  const audio = new Blob(['A'.repeat(200)], { type: 'audio/mpeg' });
  const anon = await handleCreatorLyricsRequest(req('/api/lyrics/transcribe', 'POST', '', audio, 'audio/mpeg'), env);
  assert.equal(anon.status, 401);
  const converted = await handleCreatorLyricsRequest(req('/api/lyrics/transcribe', 'POST', 'a', audio, 'audio/mpeg'), env);
  assert.equal(converted.status, 200);
  const data = await converted.json();
  assert.match(data.lyrics, /Aaj phir se/);
  assert.equal(data.reviewRequired, true);
  assert.equal(files.size, 0);
  assert.ok(calls.some(path => path.endsWith(':generateContent')));
});

test('Audio requests beyond inline limit are rejected before reading body', async t => {
  const { env, files } = setup(t);
  const audio = new Blob(['A'.repeat(1000)], { type: 'audio/mpeg' });
  const request = new Request('https://rhymeorbit.in/api/lyrics/transcribe', {
    method: 'POST', headers: { authorization: 'Bearer a', 'content-type': 'audio/mpeg', 'content-length': '20000000' }, body: audio
  });
  assert.equal((await handleCreatorLyricsRequest(request, env)).status, 413);
  assert.equal(files.size, 0);
});
