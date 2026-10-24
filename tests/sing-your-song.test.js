import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SONGS,durationOf,midiToHz,hzToMidi,targetAt,lineAt,pitchDistance,detectPitch,summarizePerformance} from '../public/sing-your-song-core.js';
import {parseTimedLyrics} from '../cloudflare/creator-lyrics.js';

const page=readFileSync(new URL('../public/sing-your-song.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../public/sing-your-song.js',import.meta.url),'utf8');
const headers=readFileSync(new URL('../public/_headers',import.meta.url),'utf8');
const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));

test('Sing Your Song is a separate, indexable and discoverable page',()=>{
  assert.match(page, /<title>Sing Your Song/);
  assert.match(page, /rel="canonical" href="https:\/\/rhymeorbit\.in\/sing-your-song"/);
  assert.match(readFileSync(new URL('../public/sitemap.xml',import.meta.url),'utf8'),/https:\/\/rhymeorbit\.in\/sing-your-song/);
  assert.match(readFileSync(new URL('../public/feature-guide.js',import.meta.url),'utf8'),/Sing Your Song/);
  assert.ok(vercel.rewrites.some(item=>item.source==='/sing-your-song'&&item.destination==='/sing-your-song.html'));
  for(const section of ['ssSongs','ssCoach','ssHistory','ssStart','ssListen','ssCoachStart','ssHistoryList'])assert.match(page,new RegExp('id="'+section+'"'));
});

test('Microphone access is scoped, permissioned and recordings are local only',()=>{
  assert.match(headers,/\/sing-your-song\*[\s\S]*microphone=\(self\)/);
  assert.match(script,/navigator\.mediaDevices\.getUserMedia/);
  assert.match(script,/createMediaStreamDestination\(/);
  assert.match(script,/new MediaRecorder\(/);
  assert.match(script,/indexedDB\.open\(DB,1\)/);
  assert.doesNotMatch(script,/fetch\(|cloudflare|r2\.cloudflare|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(page,/not uploaded/);
});

test('Four original practice songs have reasonable 1–2 minute durations and active lyrics',()=>{
  assert.equal(SONGS.length,4);
  for(const song of SONGS){
    assert.ok(durationOf(song)>=85&&durationOf(song)<=120,song.title);
    assert.ok(song.lyrics.length>=8);
    assert.ok(song.notes.length>=8);
    assert.equal(lineAt(song,0),0);
    assert.equal(lineAt(song,durationOf(song)-.01),song.lyrics.length-1);
    assert.ok(Number.isFinite(targetAt(song,44)));
  }
});

test('Pitch detector follows a clear sung note but ignores silence',()=>{
  const rate=44100,freq=midiToHz(69);
  const samples=Float32Array.from({length:2048},(_,i)=>.2*Math.sin(2*Math.PI*freq*i/rate));
  const measured=detectPitch(samples,rate);
  assert.ok(measured&&Math.abs(measured-freq)<4,`Detected ${measured} Hz`);
  assert.equal(detectPitch(new Float32Array(2048),rate),null);
  assert.ok(pitchDistance(hzToMidi(freq),69)<.05);
  assert.ok(pitchDistance(60,72)<.05,'Comfortable octave singing should not be penalised');
  assert.equal(summarizePerformance([]).score,null);
  assert.ok(summarizePerformance(Array(12).fill({error:0})).score>=95);
});

test('AI timestamp parsing rejects invalid content and never invents timing',()=>{
  assert.equal(parseTimedLyrics('nonsense'),null);
  assert.equal(parseTimedLyrics('[{"start":4,"text":"hello"},{"start":3,"text":"wrong order"}]'),null);
  assert.equal(parseTimedLyrics('[{"start":5.2,"text":"Mera dil"},{"start":13.65,"text":"Tere sang"}]'),
    '[00:05.20] Mera dil\n[00:13.65] Tere sang');
});
