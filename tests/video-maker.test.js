import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const read = path => readFileSync(join(root, path), 'utf8');
const page = read('video-maker.html');
const script = read('video-maker.js');

test('Full-song output uses repeating ten-second animated lyric scenes up to five minutes', () => {
  assert.match(script, /const MAX_VIDEO_SECONDS = 300;/);
  assert.match(script, /const SCENE_SECONDS = 10;/);
  assert.match(script, /Math\.floor\(time \/ SCENE_SECONDS\)/);
  assert.match(script, /drawScene\(\(scene - 1\) % 5, time, 1\)/);
  assert.match(script, /const lyric = lyricLine\(time, duration\)/);
  assert.match(script, /exportStream = canvas\.captureStream\(24\)/);
  assert.match(script, /exportStream\.addTrack\(audioTrack\)/);
  assert.match(script, /const blob = new Blob\(chunks, \{ type: actualMime \}\)/);
  for (const section of ['Music', 'Lyrics', 'Style', 'Export', 'Videos']) {
    assert.match(page, new RegExp('id="vmPanel' + section + '"'));
  }
});

test('Video export runs locally, accepts private songs safely and never calls a GPU trial API', () => {
  assert.match(page, /not AI-generated cinematic footage/);
  assert.match(page, /Audio is sent to Gemini only if you request transcription/);
  assert.match(page, /id="vmAutoTranscribe"/);
  assert.match(script, /apiRequest\('\/api\/lyrics\/transcribe'/);
  assert.match(script, /apiRequest\('\/api\/music\/lyrics'/);
  assert.match(script, /const MAX_AUDIO_BYTES = 25 \* 1024 \* 1024/);
  assert.match(script, /sessionStorage\.getItem\('ro_video_selected_song'\)/);
  assert.match(script, /\/api\\\/music\\\/audio\\\//);
  assert.match(script, /response\.status !== 206/);
  assert.match(script, /const range = \/\^bytes/);
  assert.match(script, /\$\('vmRights'\)\.checked/);
  assert.doesNotMatch(script, /api\.nvidia\.com|build\.nvidia\.com|\.gpu\(|api\.runpod\.io/);
});

test('AI lyrics securely reuse existing RhymeOrbit Gemini API and authenticated Supabase session', () => {
  assert.match(page, /id="vmGenerateLyrics"/);
  assert.match(page, /id="vmIdea"/);
  assert.match(page, /id="vmLanguage"/);
  assert.match(page, /id="vmLyricMood"/);
  assert.match(page, /@supabase\/supabase-js@2\/dist\/umd\/supabase\.min\.js/);
  assert.match(script, /videoAuthClient\.auth\.getSession\(\)/);
  assert.match(script, /fetch\('\/api\/ai'/);
  assert.match(script, /Authorization: 'Bearer ' \+ token/);
  assert.match(script, /kind: 'lyrics', input: brief/);
  assert.doesNotMatch(script, /GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|AIza[A-Za-z0-9_-]{20,}/);
});

test('Without a song users can export a silent lyric video and select cartoon presets', () => {
  assert.match(page, /id="vmCharacter"/);
  for (const character of ['none','singer','cat','robot'])
    assert.match(page, new RegExp('value="' + character + '"'));
  assert.match(script, /function drawCharacter\(seconds, strength\)/);
  assert.match(script, /drawCharacter\(time, strength\)/);
  assert.match(script, /exportTarget = videoDuration\(\)/);
  assert.match(script, /const silent = \['video\/mp4;codecs=avc1\.42E01E'/);
  assert.match(script, /const seconds = exportAudio \? exportAudio\.currentTime : \(performance\.now\(\) - exportStartedAt\) \/ 1000/);
});

test('New video exports stay on the device while earlier R2 files remain readable', () => {
  assert.doesNotMatch(page, /id="vmAutoSave"/);
  assert.match(page, /id="vmMySongs"/);
  assert.match(page, /id="vmVideoLibrary"/);
  assert.match(script, /const withAudio = \['video\/webm;codecs=vp8,opus'/);
  assert.match(script, /apiRequest\('\/api\/music\/library'/);
  assert.doesNotMatch(script, /apiRequest\('\/api\/videos\/upload'/);
  assert.match(script, /apiRequest\('\/api\/videos'/);
  assert.match(page, /id="vmLocalNotice"/);
  assert.match(page, /not uploaded or saved/);
  assert.match(script, /popup\.showModal\(\)/);
});

test('Free sing-along records microphone and owned music into a local audio download', () => {
  assert.match(page, /id="vmKaraoke"/);
  assert.match(page, /id="vmKaraokeDownload"/);
  assert.match(script, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(script, /mic\.connect\(vocalGain\);vocalGain\.connect\(mix\)/);
  assert.match(script, /song\.connect\(musicGain\);musicGain\.connect\(mix\)/);
  assert.match(script, /karaokeRecording = new Blob\(chunks/);
  assert.match(script, /setLoadedBlob\(karaokeRecording/);
});

test('Video-maker discovery URLs are indexable and included in the existing sitemap', () => {
  assert.match(page, /rel="canonical" href="https:\/\/rhymeorbit\.in\/video-maker"/);
  assert.match(read('sitemap.xml'), /<loc>https:\/\/rhymeorbit\.in\/video-maker<\/loc>/);
  assert.match(read('features.html'), /href="\/video-maker"/);
  assert.match(read('index.html'), /video-maker/);
});
