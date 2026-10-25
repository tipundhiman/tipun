import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Video maker can export with original instrumental or muted sound without a paid-song request', () => {
  const html = read('public/video-maker.html');
  const video = read('public/video-maker.js');
  const music = read('public/creative-audio.js');
  assert.match(html, /id="vmAudioMode"/);
  assert.match(html, /value="ambient"/);
  assert.match(html, /value="silent"/);
  assert.match(video, /createAmbientMusic\(exportContext, monitor,\{mood:/);
  assert.match(video, /exportStream\.addTrack\(audioTrack\)/);
  assert.match(video, /exportAmbient\?\.stop\(\)/);
  assert.match(video, /monitor\.connect\(dest\)/);
  assert.match(video, /monitor\.connect\(exportContext\.destination\)/);
  assert.match(html, /id="vmMusicMood"/);
  for (const mood of ['romantic','dreamy','happy','calm']) assert.match(html,new RegExp('value="'+mood+'"'));
  assert.doesNotMatch(music, /\/api\/music\/generate|TREBLO_API_KEY|NVIDIA_API_KEY/);
});

test('Shayari offers editable speech, local music and silent preview', () => {
  const script = read('public/media.js');
  assert.match(script, /roShayariEditable/);
  assert.match(script, /roShayariSoundMode/);
  for (const mode of ['both', 'voice', 'music', 'silent'])
    assert.ok(script.includes("['" + mode + "',") || script.includes(",'" + mode + "',"));
  assert.match(script, /roCreativeAudio\.speak/);
});

test('Riya never uses NVIDIA hosted trial credits in production without explicit opt-in', () => {
  const api = read('api/index.js');
  assert.match(api, /env\('NVIDIA_NIM_COMMERCIAL_ENABLED'\) !== 'true'/);
  assert.match(api, /!env\('NVIDIA_API_KEY'\)/);
  assert.match(api, /kind === 'help'/);
  assert.match(api, /provider: 'gemini'/);
  assert.match(api, /provider: 'nvidia'/);
});

test('On-site featured YouTube music cards are not external redirects', () => {
  const fallback = read('public/youtube-fallback.js');
  assert.match(fallback, /window\.roYtPlay/);
  assert.match(fallback, /showFeatured/);
  assert.doesNotMatch(fallback, /Continue on YouTube|window\.location\.assign/);
  assert.match(fallback, /No embeddable videos found/);
  assert.match(fallback, /link\.target = '_blank'/, 'An explicit external search opens a new tab only when in-app matches do not exist');
});
