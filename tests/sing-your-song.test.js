import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SONGS,durationOf,midiToHz,hzToMidi,targetAt,lineAt,pitchDistance,detectPitch,summarizePerformance} from '../public/sing-your-song-core.js';
import {parseTimedLyrics} from '../cloudflare/creator-lyrics.js';
import {parseSingAlongLyrics,activeLyricIndex,duckTargetVolume} from '../public/sing-audius-core.js';

const page=readFileSync(new URL('../public/sing-your-song.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../public/sing-your-song.js',import.meta.url),'utf8');
const indieScript=readFileSync(new URL('../public/sing-jamendo.js',import.meta.url),'utf8');
const audiusScript=readFileSync(new URL('../public/sing-audius.js',import.meta.url),'utf8');
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
  assert.match(script,/analyser\.connect\(silent\)\.connect\(ctx\.destination\)/,'Coach analyser needs a live audio graph');
  assert.match(script,/analyser\.connect\(highpass\)/,'Song analyser must feed recording graph');
  assert.match(page,/id="ssCoachMicLevel"/);
  assert.match(page,/id="ssSongMicLevel"/);
  assert.match(page,/id="ssVoicePolish"/);
  assert.match(page,/no pitch correction/,'Studio polish must not be falsely sold as Auto-Tune');
});

test('30-second indie karaoke uses existing Jamendo endpoint, voice-only microphone and local recordings',()=>{
  for(const section of ['ssTabIndie','ssIndie','ssIndieQuery','ssIndieList','ssIndieListen','ssIndieRecord','ssIndieStop','ssIndieDownload'])
    assert.match(page,new RegExp('id="'+section+'"'));
  assert.match(page,/sing-jamendo\.js/);
  assert.match(indieScript,/\/api\/jamendo\/search\?q=/);
  assert.match(indieScript,/&instrumental=1/);
  assert.match(indieScript,/new MediaRecorder\(mic/);
  assert.match(indieScript,/from \+ 30/);
  assert.match(indieScript,/window\.roSaveIndieSinging/);
  assert.match(script,/window\.roSaveIndieSinging\s*=/);
  assert.match(page,/records only your microphone|voice only|your mic input/i);
  assert.doesNotMatch(indieScript,/JAMENDO_CLIENT_ID|JAMENDO_CLIENT_SECRET|fetch\(.+\.mp3|r2\.cloudflare/);
});

test('Audius Sing Along has independent search, playback, mic ducking, local-only voice recording and editable lyrics',()=>{
  for(const section of ['ssTabAudius','ssAudius','ssAudiusForm','ssAudiusQuery','ssAudiusList','ssAudiusListen','ssAudiusSing','ssAudiusStop','ssAudiusLyrics','ssAudiusLyricsApply','ssAudiusLyricsClear','ssAudiusLyricsReset','ssAudiusDownload'])
    assert.match(page,new RegExp('id="'+section+'"'));
  assert.match(page,/sing-audius\.js/);
  assert.match(audiusScript,/https:\/\/api\.audius\.co\/v1\/tracks\/search/);
  assert.match(audiusScript,/audio\.src = selected\.audio/);
  assert.match(audiusScript,/createMediaElementSource\(audio\)\.connect\(musicGain\)/);
  assert.match(audiusScript,/navigator\.mediaDevices\.getUserMedia/);
  assert.match(audiusScript,/new MediaRecorder\(mic/);
  assert.match(audiusScript,/duckTargetVolume/);
  assert.match(audiusScript,/localStorage\.setItem\(lyricKey/);
  assert.match(audiusScript,/localStorage\.removeItem\(lyricKey/);
  assert.match(audiusScript,/window\.roSaveAudiusSinging/);
  assert.match(script,/window\.roSaveAudiusSinging\s*=/);
  assert.doesNotMatch(audiusScript,/cloudflare\.com\/.*upload|SUPABASE_SERVICE_ROLE_KEY/);
});

test('Sing Along offers opt-in Gemini audio-to-text for owned audio and voice-only takes',()=>{
  for(const id of ['ssAudiusOwnAudio','ssAudiusAudioRights','ssAudiusTranscribeFile','ssAudiusTranscribeTake','ssAudiusTranscribeStatus'])
    assert.match(page,new RegExp('id="'+id+'"'));
  assert.match(page,/I own or have permission to transcribe this audio/);
  assert.match(page,/@supabase\/supabase-js@2\/dist\/umd\/supabase\.min\.js/);
  assert.match(audiusScript,/\$\('ssAudiusAudioRights'\)\.checked/);
  assert.match(audiusScript,/lastVoiceTake = \{blob, trackId\}/);
  assert.match(audiusScript,/source === 'take' \? lastVoiceTake\?\.blob : \$\('ssAudiusOwnAudio'\)\.files\?\.\[0\]/);
  assert.match(audiusScript,/maxTranscribeBytes = 13 \* 1024 \* 1024/);
  assert.match(audiusScript,/await aiSessionToken\(\)/);
  assert.match(audiusScript,/fetch\('\/api\/lyrics\/transcribe'/);
  assert.match(audiusScript,/window\.confirm\('Replace the current lyrics/);
  assert.match(audiusScript,/revision !== lyricRevision/,'Do not clobber edits made while transcription runs');
  assert.match(audiusScript,/applyLyrics\(\)/,'Transcribed words must enter the existing karaoke lyrics stage');
  assert.match(readFileSync(new URL('../public/privacy.html',import.meta.url),'utf8'),/explicitly choose to transcribe/);
});

test('LRC lyrics sync precisely while untimed custom lyrics use honest estimated positions',()=>{
  const timed=parseSingAlongLyrics('[00:10.50] पहली लाइन\n[00:20.00] दूसरी लाइन');
  assert.equal(timed.timed,true);
  assert.equal(activeLyricIndex(timed,2,40),-1);
  assert.equal(activeLyricIndex(timed,11,40),0);
  assert.equal(activeLyricIndex(timed,11,40,10),1);
  const plain=parseSingAlongLyrics('New lyrics\nAnother line\nFinal line');
  assert.equal(plain.timed,false);
  assert.equal(activeLyricIndex(plain,25,60),1);
  assert.equal(parseSingAlongLyrics('').lines.length,0);
  assert.equal(duckTargetVolume(0.05,0.018,0.7,30),0.21);
  assert.equal(duckTargetVolume(0,0.018,0.7,30),0.7);
});

test('Original practice lyrics support writing new lines, clearing, saving and restoration per song',()=>{
  for(const id of ['ssOriginalLyricsSave','ssOriginalLyricsClear','ssOriginalLyricsReset'])assert.match(script,new RegExp(id));
  assert.match(script,/localStorage\.setItem\(practiceLyricsKey\(selected\)/);
  assert.match(script,/localStorage\.removeItem\(practiceLyricsKey\(selected\)/);
  assert.match(script,/practiceLyrics=\[\.\.\.selected\.lyrics\]/);
  assert.match(script,/practiceLyrics\[line\]/);
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

test('Pitch detector responds to softly sung male and female tones with harmonics',()=>{
  for(const freq of [75,110,150,220,440,660]){
    const samples=Float32Array.from({length:8192},(_,i)=>
      .025*Math.sin(2*Math.PI*freq*i/48000)+.01*Math.sin(4*Math.PI*freq*i/48000));
    const measured=detectPitch(samples,48000);
    assert.ok(measured&&Math.abs(measured-freq)<3,`${freq} Hz yielded ${measured}`);
  }
  assert.equal(detectPitch(new Float32Array(8192),48000),null);
});

test('Karaoke search labels reflect the licensed four-track library',()=>{
  assert.match(page,/id="ssSearch"/);
  assert.match(page,/id="ssLanguage"/);
  assert.match(script,/filterSongs/);
  assert.match(script,/if\(firstMatch&&!selectionVisible&&!running\)chooseSong\(firstMatch\)/);
  assert.match(script,/if\(!running\)\{\$\('ssListen'\)\.disabled=!count/);
  assert.match(page,/only 4 original|current 4 original/);
});

test('AI timestamp parsing rejects invalid content and never invents timing',()=>{
  assert.equal(parseTimedLyrics('nonsense'),null);
  assert.equal(parseTimedLyrics('[{"start":4,"text":"hello"},{"start":3,"text":"wrong order"}]'),null);
  assert.equal(parseTimedLyrics('[{"start":5.2,"text":"Mera dil"},{"start":13.65,"text":"Tere sang"}]'),
    '[00:05.20] Mera dil\n[00:13.65] Tere sang');
});
