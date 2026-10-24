import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const read = path => readFileSync(join(root, path), 'utf8');
const page = read('video-maker.html');
const script = read('video-maker.js');

test('One 50s output consists of five ten-second animated lyric scenes', () => {
  assert.match(script, /const MAX_VIDEO_SECONDS = 50;/);
  assert.match(script, /const SCENE_SECONDS = 10;/);
  assert.match(script, /Math\.min\(4, Math\.floor\(time \/ SCENE_SECONDS\)\)/);
  assert.match(script, /drawScene\(scene - 1, time, 1\)/);
  assert.match(script, /const lyric = lyricLine\(time, duration\)/);
  assert.match(script, /exportStream = canvas\.captureStream\(24\)/);
  assert.match(script, /exportStream\.addTrack\(audioTrack\)/);
  assert.match(script, /const blob = new Blob\(chunks, \{ type: actualMime \}\)/);
  for (const section of ['Music', 'Lyrics', 'Style', 'Export']) {
    assert.match(page, new RegExp('id="vmPanel' + section + '"'));
  }
});

test('Video export runs locally, accepts private songs safely and never calls a GPU trial API', () => {
  assert.match(page, /not AI-generated cinematic footage/);
  assert.match(page, /not upload your selected audio/);
  assert.match(script, /const MAX_AUDIO_BYTES = 25 \* 1024 \* 1024/);
  assert.match(script, /sessionStorage\.getItem\('ro_video_selected_song'\)/);
  assert.match(script, /\/api\\\/music\\\/audio\\\//);
  assert.match(script, /response\.status !== 206/);
  assert.match(script, /const range = \/\^bytes/);
  assert.match(script, /\$\('vmRights'\)\.checked/);
  assert.doesNotMatch(script, /api\.nvidia\.com|build\.nvidia\.com|\.gpu\(|api\.runpod\.io/);
});

test('Video-maker discovery URLs are indexable and included in the existing sitemap', () => {
  assert.match(page, /rel="canonical" href="https:\/\/rhymeorbit\.in\/video-maker"/);
  assert.match(read('sitemap.xml'), /<loc>https:\/\/rhymeorbit\.in\/video-maker<\/loc>/);
  assert.match(read('features.html'), /href="\/video-maker"/);
  assert.match(read('index.html'), /video-maker/);
});
