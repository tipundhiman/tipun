import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { creditBalance, SONG_CREDIT_COST, PLAN_SONG_LIMITS } from '../api/orbit-credits.js';
test('100 Orbit Credits represents exactly one server-reserved generation',()=>{
 assert.equal(SONG_CREDIT_COST,100);
 assert.deepEqual(PLAN_SONG_LIMITS,{free:3,premium:35,pro:75});
 for(const [tier,limit] of Object.entries(PLAN_SONG_LIMITS)){
  const c=creditBalance(limit,0,0);
  assert.equal(c.creditBalance.monthly,limit*100,tier);
  assert.equal(c.creditBalance.remaining,limit*100,tier);
  assert.equal(c.songsRemaining,limit);
  assert.equal(creditBalance(limit,1,1).creditBalance.remaining,(limit-2)*100);
 }
});
test('Credit display never becomes negative or inflated by invalid usage',()=>{
 const c=creditBalance(3,9,4);
 assert.equal(c.songsRemaining,0);
 assert.equal(c.creditBalance.remaining,0);
 assert.equal(creditBalance(3,-2,-3).creditBalance.remaining,300);
 assert.equal(creditBalance(NaN,2,0).creditBalance.monthly,0);
});
test('Frontend shows server-returned real credits instead of trusting browser balances',()=>{
 const index=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const pricing=fs.readFileSync(new URL('../public/memberships.js',import.meta.url),'utf8');
 const api=fs.readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(index,/balance\.creditBalance\?\.remaining/);
 assert.match(index,/100 credits = 1 song/);
 assert.match(pricing,/100 Orbit Credits = 1 AI song/);
 assert.match(api,/creditBalance\(limit, used, reserved\)/);
 assert.match(api,/creditUnit:'orbit'/);
 assert.match(api,/s\.status === 'active'/);
 assert.match(api,/downloadHighQuality/);
});
test('Payment cannot activate from a credit display update',()=>{
 const worker=fs.readFileSync(new URL('../cloudflare/worker.js',import.meta.url),'utf8');
 const billing=fs.readFileSync(new URL('../public/play-billing.js',import.meta.url),'utf8');
 assert.match(worker,/checkoutEnabled:false/);
 assert.match(billing,/readyForCheckout:\(\)=>false/);
});
