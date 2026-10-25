import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLicensedLyricsRequest } from '../cloudflare/licensed-lyrics.js';

const path = '/api/lyrics/match?title=Kesariya&artist=Arijit%20Singh&duration=235';
const request = uri => new Request('https://rhymeorbit.in' + uri, { headers: { 'cf-connecting-ip': '192.0.2.91' } });
const env = { MUSIXMATCH_API_KEY: 'placeholder', MUSIXMATCH_DISPLAY_LICENSED: 'true' };
const apiResult = (body, status = 200) => Response.json({ message: { header: { status_code: status }, body } });

test('Licensed lookup remains safely disabled unless display rights and key both exist', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Provider must never be called without rights'); });
  assert.equal((await (await handleLicensedLyricsRequest(request(path), {})).json()).status, 'unavailable');
  assert.equal((await (await handleLicensedLyricsRequest(request(path), { MUSIXMATCH_API_KEY: 'secret' })).json()).status, 'unavailable');
  assert.equal((await (await handleLicensedLyricsRequest(request(path), { MUSIXMATCH_DISPLAY_LICENSED: 'true' })).json()).status, 'unavailable');
});

test('Commercial lyrics resolve via official matcher and never expose the API key', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(new URL(url).pathname, '/ws/1.1/matcher.lyrics.get');
    assert.equal(new URL(url).searchParams.get('q_track'), 'Kesariya');
    assert.equal(new URL(url).searchParams.get('q_artist'), 'Arijit Singh');
    assert.equal(new URL(url).searchParams.get('apikey'), 'placeholder');
    return apiResult({ lyrics: { lyrics_body: 'Raah mein teri\nDil hai mera', lyrics_copyright: '© Publishers' } });
  });
  const response = await handleLicensedLyricsRequest(request(path), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, 'ok');
  assert.equal(result.timed, false);
  assert.equal(result.provider, 'Musixmatch');
  assert.equal(result.lyrics, 'Raah mein teri\nDil hai mera');
  assert.doesNotMatch(JSON.stringify(result), /placeholder/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('Synchronized LRC is used only when a separate sync license is configured', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(new URL(url).pathname);
    return apiResult({ subtitle: { subtitle_body: '[00:12.50]Dil se\n[00:18.00]Gaate hai', subtitle_copyright: '© Writers' } });
  });
  const data = await (await handleLicensedLyricsRequest(request(path), { ...env, MUSIXMATCH_SYNC_LICENSED: 'true' })).json();
  assert.equal(data.status, 'ok');
  assert.equal(data.timed, true);
  assert.deepEqual(calls, ['/ws/1.1/matcher.subtitle.get']);
});

test('Restricted or demo-truncated lyrics are never shown as complete songs', async t => {
  t.mock.method(globalThis, 'fetch', async () => apiResult({ lyrics: { lyrics_body: 'First line\n******* This Lyrics is NOT for Commercial use *******' } }));
  const result = await (await handleLicensedLyricsRequest(request(path), env)).json();
  assert.equal(result.status, 'not_found');
  assert.equal('lyrics' in result, false);
});

test('Invalid lookup input is rejected before calling the provider', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Invalid inputs must not fetch'); });
  const response = await handleLicensedLyricsRequest(request('/api/lyrics/match?title=K&artist='), env);
  assert.equal(response.status, 400);
  assert.equal(await handleLicensedLyricsRequest(request('/api/other'), env), null);
});
