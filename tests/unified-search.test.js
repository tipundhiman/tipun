import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const source = readFileSync(new URL('../public/jamendo-indie.js', import.meta.url), 'utf8');
const from = source.indexOf('  async function searchAllAudio(');
const to = source.indexOf('  function showCatalog()', from);
assert.ok(from > 0 && to > from, 'Unified song search function should exist');
const functionSource = source.slice(from, to);

function setup(audius, jamendo, available = true) {
  const status = { textContent: '' };
  const notice = { hidden: true, textContent: '' };
  const modes = [];
  let videoSearches = 0;
  const elements = { roUnifiedSearchStatus: status, roAutoFallbackNotice: notice, roListenSourceModes: {} };
  const context = createContext({
    unifiedRequest: 0, available,
    document: { getElementById: id => elements[id] || null },
    searchIndianCatalog: async () => audius,
    searchJamendo: async () => jamendo,
    selectSource: mode => modes.push(mode),
    window: { roYtSearch: async () => { videoSearches++; } }
  });
  runInContext(functionSource + '\nwindow.runUnified = searchAllAudio;', context);
  return { run: query => context.window.runUnified(query), status, notice, modes, youtubeCount: () => videoSearches };
}

test('Free audio matches stay in Songs mode and do not waste YouTube requests', async () => {
  const app = setup({ count: 3, failed: false }, { count: 1, failed: false });
  await app.run('Hindi romantic');
  assert.equal(app.youtubeCount(), 0);
  assert.equal(app.modes.length, 0);
  assert.match(app.status.textContent, /4 playable audio matches/);
});

test('No free audio automatically searches YouTube using a separate video mode', async () => {
  const app = setup({ count: 0, failed: false }, { count: 0, failed: false });
  await app.run('Some rare song');
  assert.equal(app.youtubeCount(), 1);
  assert.deepEqual(app.modes, ['videos']);
  assert.equal(app.notice.hidden, false);
  assert.match(app.notice.textContent, /No playable free audio found/);
});

test('Audio-provider downtime is distinguished from a genuine no-match result', async () => {
  const app = setup({ count: 0, failed: true }, { count: 0, failed: true });
  await app.run('Song');
  assert.equal(app.youtubeCount(), 1);
  assert.match(app.notice.textContent, /sources are unavailable/);
});

test('When Jamendo is disabled, Audius still determines automatic fallback', async () => {
  const app = setup({ count: 0, failed: false }, { count: 0, failed: false }, false);
  await app.run('Song');
  assert.equal(app.youtubeCount(), 1);
  assert.deepEqual(app.modes, ['videos']);
});
