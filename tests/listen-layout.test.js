import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../public/jamendo-indie.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/premium-polish.css', import.meta.url), 'utf8');
const listenCss = readFileSync(new URL('../public/listen-polish.css', import.meta.url), 'utf8');
const youtube = readFileSync(new URL('../public/youtube-fallback.js', import.meta.url), 'utf8');
const player = readFileSync(new URL('../public/listen-player.js', import.meta.url), 'utf8');

test('Listen & Chill keeps music, video and Audius community catalog in distinct modes', () => {
  for (const mode of ["['music', '♫ Listen to Music']", "['indian', '🇮🇳 Hindi & More · Audius']", "['videos', '▶ Watch Music Videos']"]) {
    assert.ok(ui.includes(mode), `Missing source mode ${mode}`);
  }
  assert.match(ui, /catalog\.hidden = !music/);
  assert.match(ui, /indianCatalog\.hidden = mode !== 'indian'/);
  assert.match(ui, /selectSource\('indian'\)/,'Hindi songs should be the first browse mode');
  assert.match(ui, /insertBefore\(modes, document\.getElementById\('roVideoFolders'\) \|\| status\)/,'Music source tabs appear before video folders');
  assert.match(ui, /mode==='music' && available && !indieLoaded/,'Load indie songs only when requested');
  assert.match(ui, /previousMode !== mode\) window\.roCcPlayer\?\.pause\(\)/, 'Source switches pause the shared audio');
});

test('indie music renders six songs at a time with accessible show more', () => {
  assert.match(ui, /const batchSize = 6/);
  assert.match(ui, /cachedTracks\.slice\(shownCount, shownCount \+ batchSize\)/);
  assert.match(ui, /showNextSongs\(\)/);
  assert.match(ui, /more\.hidden = !remaining && !moreOffset/);
});

test('Audius player uses verified catalog audio URLs and keeps video discovery available', () => {
  assert.match(ui, /\/api\/catalog\/audius\/search\?q=/);
  assert.match(ui, /https:\/\/api\.audius\.co\/v1\/tracks\/search\?query=/);
  assert.match(ui, /normalizePublicAudiusTrack/);
  assert.match(ui, /checkedHttps\(track\.audio,\s*'api\.audius\.co'\)/);
  assert.match(ui, /event\.stopImmediatePropagation\(\)/);
  assert.match(ui, /if \(mode === 'indian'\) searchIndianCatalog\(query\)/);
  assert.doesNotMatch(ui, /Find music video/,'Do not distract Hindi audio listeners with per-card video search');
  assert.doesNotMatch(ui, /track\.audioUrl|track\.stream_urls/);
});

test('Audius and Jamendo use the animated DJ stage as one audio player with transport controls', () => {
  assert.match(html, /listen-player\.js\?v=/);
  assert.match(html, /id="roCcScene"/);
  assert.match(ui, /window\.roCcPlayer\?\.playFrom\('audius',indianTracks,track\.id\)/);
  assert.match(ui, /window\.roCcPlayer\?\.playFrom\('jamendo', cachedTracks, item\.id\)/);
  assert.doesNotMatch(ui, /document\.createElement\('audio'\)/, 'Per-card duplicate audio elements must not compete with DJ');
  for (const id of ['roCcAudio','roCcToggle','roCcPrev','roCcNext','roCcSeek','roCcVolume','roCcNowTitle'])
    assert.ok(player.includes(`id="${id}"`), `Shared DJ player missing ${id}`);
  assert.match(player, /stage\.classList\.toggle\('playing', playing\)/);
  assert.match(player, /audio\.addEventListener\('timeupdate', updateProgress\)/);
  assert.match(player, /provider === 'audius' && host === 'api\.audius\.co'/);
  assert.match(player, /provider === 'jamendo' && \(host === 'storage\.jamendo\.com'/);
  assert.doesNotMatch(player, /youtube\.com|youtube-nocookie\.com|youtu\.be/);
  assert.match(listenCss, /#roCcScene \.ro-cc-console/);
  assert.match(listenCss, /prefers-reduced-motion:reduce/);
});

test('Hindi audio collections use real play counts, upload dates and Audius weekly trending',()=>{
  for(const category of ['Hindi picks','Trending worldwide','Most played','New uploads','Romantic','Devotional','Punjabi','Haryanvi','Bhojpuri'])assert.ok(ui.includes(category));
  assert.match(ui,/tracks\/trending\?time=week&limit=30/);
  assert.match(ui,/track\.play_count/);
  assert.match(ui,/track\.release_date/);
  assert.match(ui,/folderId==='played'\)indianTracks\.sort/);
  assert.match(ui,/folderId==='new'\)indianTracks\.sort/);
  assert.match(ui,/showNextIndianSongs/);
  assert.match(ui,/const indianPageSize = 8/);
});

test('YouTube keeps the official embedded player with curated Hindi videos and honest fallbacks',()=>{
  assert.match(html,/listen-polish\.css/);
  assert.match(youtube,/BSJa1UytM8w/);
  assert.match(youtube,/tk8ya-cJtrs/);
  assert.match(youtube,/installVideoFolders/);
  assert.match(youtube,/live YouTube search requires an API key/);
  assert.doesNotMatch(youtube,/\.forEach\(link => link\.remove\(\)\)/);
  assert.match(listenCss,/#roYtPlayer iframe/);
  assert.match(listenCss,/max-width:640px/);
});

test('dark-luxe theme includes reduced-motion and mobile layouts', () => {
  assert.match(html, /premium-polish\.css/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-width: 520px/);
  assert.match(css, /focus-visible/);
});
