import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const read = path => readFileSync(join(root, path), 'utf8');
const page = read('index.html');
const workspace = read('creator-workspace.js');

test('Studio is compact and the Download Audio route owns the song library', () => {
  assert.match(page, /\['downloads','Download Audio'\]/);
  assert.match(page, /function downloads\(\)/);
  assert.match(page, /id="roMyStudioSongs"/);
  assert.match(page, /\['video','Video Maker'\]/);
  assert.match(page, /function go\(page\)\{if\(page==='video'\)/);
  assert.match(workspace, /document\.getElementById\('roSongLibrary'\)\?\.remove\(\)/);
  assert.match(workspace, /const specs = \[\['create', '✦ Create Song', creator\], \['doctor', '✧ Song Doctor', doctor\]\]/);
  assert.match(workspace, /advanced\.append\(summary, \.\.\.formatFields\)/);
  assert.doesNotMatch(page, /const roBaseProjectsSongs=window\.projects/);
});

test('Downloads keep the existing private audio proxy and premium format restrictions', () => {
  for (const format of ['mp3-128','mp3-192','mp3-256','mp3-320','wav','original']) {
    assert.ok(page.includes(format), 'Missing format: ' + format);
  }
  assert.match(page, /Premium\/Pro/);
  assert.match(page, /roIsPrivateAudioUrl\(item\.proxyUrl\)/);
  assert.match(page, /ro_video_selected_song/);
  assert.match(page, /lyrics:text/);
  assert.match(page, /if\(!window\.roCloudSyncRunning\)/);
  assert.match(page, /className='ro-song-drawer'/);
});
