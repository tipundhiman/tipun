import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../public/jamendo-indie.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/premium-polish.css', import.meta.url), 'utf8');

test('Listen & Chill keeps music, video and Audius community catalog in distinct modes', () => {
  for (const mode of ["['music', '♫ Listen to Music']", "['indian', '🇮🇳 Hindi & More · Audius']", "['videos', '▶ Watch Music Videos']"]) {
    assert.ok(ui.includes(mode), `Missing source mode ${mode}`);
  }
  assert.match(ui, /catalog\.hidden = !music/);
  assert.match(ui, /indianCatalog\.hidden = mode !== 'indian'/);
  assert.match(ui, /if \(!music\) document\.querySelectorAll\('#roJamendoResults audio'\)/);
});

test('indie music renders six songs at a time with accessible show more', () => {
  assert.match(ui, /const batchSize = 6/);
  assert.match(ui, /cachedTracks\.slice\(shownCount, shownCount \+ batchSize\)/);
  assert.match(ui, /showNextSongs\(\)/);
  assert.match(ui, /more\.hidden = !remaining && !moreOffset/);
});

test('Audius player uses verified catalog audio URLs and keeps video discovery available', () => {
  assert.match(ui, /\/api\/catalog\/audius\/search\?q=/);
  assert.match(ui, /checkedHttps\(track\.audio, 'api\.audius\.co'\)/);
  assert.match(ui, /event\.stopImmediatePropagation\(\)/);
  assert.match(ui, /window\.roYtSearch\?\./);
  assert.doesNotMatch(ui, /track\.audioUrl|track\.stream_urls/);
});

test('dark-luxe theme includes reduced-motion and mobile layouts', () => {
  assert.match(html, /premium-polish\.css/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-width: 520px/);
  assert.match(css, /focus-visible/);
});
