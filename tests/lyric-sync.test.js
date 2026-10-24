import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code=readFileSync(new URL('../public/lyric-sync.js',import.meta.url),'utf8');
const sandbox={window:{}};
runInNewContext(code,sandbox);
const sync=sandbox.window.roLyricSync;

test('Timed captions in exported video select by actual song position, not equal line spacing',()=>{
  const lyrics='[00:04.00] First sung line\n[00:19.20] Second line\n[00:41.50] Chorus';
  assert.equal(sync.at(lyrics,3.9,120,0,'Title'),'Title');
  assert.equal(sync.at(lyrics,4,120),'First sung line');
  assert.equal(sync.at(lyrics,18,120),'First sung line');
  assert.equal(sync.at(lyrics,19.2,120),'Second line');
  assert.equal(sync.at(lyrics,42,120),'Chorus');
  assert.equal(sync.at(lyrics,22.2,120,3),'Second line');
});

test('Fallback remains available for lyric-only animation, format handles minute boundary',()=>{
  assert.equal(sync.at('First\nSecond',5,20),'First');
  assert.equal(sync.at('First\nSecond',15,20),'Second');
  assert.equal(sync.format(61.239),'[01:01.24]');
  assert.equal(sync.isTimed(sync.rows('[00:03.00] First\n[00:07.50] Second')),true);
  assert.equal(sync.isTimed(sync.rows('[00:07.50] Second\n[00:03.00] First')),false);
});
