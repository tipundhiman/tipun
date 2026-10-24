import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createContext,runInContext} from 'node:vm';

const html=readFileSync(resolve('public/index.html'),'utf8');
const encoder=readFileSync(resolve('public/vendor/lamejs.iife.js'),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
 .filter(m=>!(/\bsrc=|application\/ld\+json/.test(m[1])))
 .map(m=>m[2]);
const script=scripts.find(s=>s.includes('function roPcmWav('));
assert.ok(script,'Song export logic must exist');
const start=script.indexOf('  let roMp3EncoderPromise;');
const end=script.indexOf('  async function roDownloadPrivateSong(',start);
assert.ok(start>=0&&end>start);
const sampleRate=44100,length=sampleRate;
const samples=Float32Array.from({length},(_,i)=>Math.sin(2*Math.PI*i*440/sampleRate)*0.23);
const decoded={numberOfChannels:1,length,sampleRate,getChannelData(){return samples}};

test('MP3 bitrate controls produce real encoded audio; WAV has valid PCM RIFF header',async()=>{
 const vm=createContext({window:{},Blob,ArrayBuffer,DataView,Int16Array,Math,Promise,setTimeout});
 runInContext(encoder,vm);vm.window.lamejs=vm.lamejs;
 assert.equal(typeof vm.lamejs.Mp3Encoder,'function');
 runInContext(script.slice(start,end),vm);
 const wav=vm.roPcmWav(decoded);
 assert.equal(wav.type,'audio/wav');
 const bytes=new DataView(await wav.arrayBuffer());
 const four=(offset)=>String.fromCharCode(...Array.from({length:4},(_,i)=>bytes.getUint8(offset+i)));
 assert.equal(four(0),'RIFF');assert.equal(four(8),'WAVE');
 assert.equal(bytes.getUint16(22,true),1);
 assert.equal(bytes.getUint32(24,true),44100);
 assert.equal(bytes.getUint32(40,true),length*2);
 const low=await vm.roMp3FromAudio(decoded,128),high=await vm.roMp3FromAudio(decoded,320);
 assert.equal(low.type,'audio/mpeg');assert.equal(high.type,'audio/mpeg');
 assert.ok(low.size>8000,'128 kbps output is real audio');
 assert.ok(high.size>low.size*1.9,'320 kbps output is larger than 128 kbps output');
 const magic=new Uint8Array(await low.arrayBuffer());
 assert.equal(magic[0],255,'Encoded MP3 starts with an MPEG sync header');
 assert.equal(magic[1]&0xe0,0xe0);
});
