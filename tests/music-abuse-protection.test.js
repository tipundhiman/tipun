import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../cloudflare/worker.js';
const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
test('Cloudflare expensive music generation has an IP burst limit plus DB song quota',()=>{
 const limiter=config.ratelimits.find(x=>x.name==='MUSIC_GENERATION_RATE_LIMITER');
 assert.ok(limiter);
 assert.equal(limiter.simple.period,60);
 assert.ok(limiter.simple.limit>0 && limiter.simple.limit<=6);
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(api,/ro_reserve_song/);
 assert.match(api,/ro_finish_song/);
 assert.match(api,/ro_refund_failed_song/);
});
test('Cloudflare returns 429 before any AI provider call when per-IP limit is exhausted',async()=>{
 let checked=0;
 const req=new Request('https://rhymeorbit.in/api/music/generate',{
  method:'POST',headers:{'CF-Connecting-IP':'198.51.100.24','X-Forwarded-For':'untrusted-spoof'}
 });
 const response=await worker.fetch(req,{MUSIC_GENERATION_RATE_LIMITER:{
  limit:async({key})=>{checked++;assert.equal(key,'music:198.51.100.24');return {success:false}}
 }});
 assert.equal(checked,1);
 assert.equal(response.status,429);
 assert.equal(response.headers.get('Retry-After'),'60');
 assert.match((await response.json()).error,/Too many song requests/);
});
test('Cloudflare fails closed on limiter outage before expensive generation',async()=>{
 const response=await worker.fetch(new Request('https://rhymeorbit.in/api/music/generate',{method:'POST'}),{
  MUSIC_GENERATION_RATE_LIMITER:{limit:async()=>{throw Error('rate limiter down')}}
 });
 assert.equal(response.status,503);
 assert.match((await response.json()).error,/protection is temporarily unavailable/);
});
