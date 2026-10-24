import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../public/', import.meta.url);
const html = readFileSync(new URL('vocal-lab.html', root), 'utf8');
const script = readFileSync(new URL('vocal-lab.js', root), 'utf8');
const features = readFileSync(new URL('features.html', root), 'utf8');
const home = readFileSync(new URL('index.html', root), 'utf8');
const sitemap = readFileSync(new URL('sitemap.xml', root), 'utf8');

test('Vocal Lab exposes accessible record, process, preview and download controls', () => {
  const ids = ['audioFile', 'recordBtn', 'stopBtn', 'processBtn', 'downloadBtn', 'pitchAssist', 'pitchValue',
    'beforeAudio', 'afterAudio', 'beforeCanvas', 'afterCanvas', 'gate',
    'clarity', 'preset', 'status', 'dropZone', 'originalInfo', 'processedInfo',
    'gateValue', 'clarityValue'];
  for (const id of ids) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} is missing`);
    assert.ok(script.includes(`'${id}'`), `${id} not wired up`);
  }
  assert.match(html, /<script src="\/vocal-lab\.js\?v=20261025-stereo-stems-1" defer>/);
  for (const id of ['splitBtn', 'splitStatus', 'centerAudio', 'sideAudio', 'centerDownload', 'sideDownload']) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.ok(script.includes(`'${id}'`), `${id} not wired up`);
  }
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /does not use neural AI separation or voice cloning/i);
});

test('Vocal Lab keeps recordings local and explicitly limits processing', () => {
  assert.match(script, /MAX_BYTES = 25 \* 1024 \* 1024/);
  assert.match(script, /MAX_DURATION = 180/);
  assert.match(script, /new OfflineAudioContextClass/);
  assert.match(script, /function pitchCorrectBuffer\(input, offline, strength\)/);
  assert.match(script, /new Blob\(\[raw\], \{ type: 'audio\/wav' \}\)/);
  assert.match(script, /sessionStorage\.getItem\('ro_vocal_selected_song'\)/);
  assert.match(script, /headers: \{ Range: `bytes=/);
  assert.doesNotMatch(script, /\bXMLHttpRequest\b|\bsendBeacon\s*\(/);
  assert.doesNotMatch(html, /<form\b/i);
});

test('Vocal Lab is discoverable from home, features, and sitemap', () => {
  assert.match(home, /href=\\"\/vocal-lab\\"/);
  assert.match(features, /href="\/vocal-lab"/);
  assert.match(sitemap, /https:\/\/rhymeorbit\.in\/vocal-lab/);
  assert.match(html, /rel="canonical" href="https:\/\/rhymeorbit\.in\/vocal-lab"/);
});
