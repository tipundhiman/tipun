import test from 'node:test';
import assert from 'node:assert/strict';
import {r2ConfigState,r2Enabled,r2PresignedGet,r2Put,r2Remove} from '../api/r2.js';

const keys=['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'];
const mock={
 R2_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',
 R2_ACCESS_KEY_ID:'test-readwrite-credential',
 R2_SECRET_ACCESS_KEY:'test-secret-never-return',
 R2_BUCKET_NAME:'rhymeorbit-songs'
};
function setup(){
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,mock);
 return ()=>{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}};
}
test('R2 requires complete private server configuration',()=>{
 const restore=setup();
 try{
  assert.equal(r2ConfigState(),'configured');
  assert.equal(r2Enabled(),true);
  delete process.env.R2_SECRET_ACCESS_KEY;
  assert.equal(r2ConfigState(),'incomplete');
  assert.equal(r2Enabled(),false);
  assert.throws(()=>r2PresignedGet('songs/11111111-1111-1111-1111-111111111111/t.mp3'));
 }finally{restore()}
});
test('Only scoped song and media object paths are valid; public URLs never expose secrets',()=>{
 const restore=setup();
 try{
  const path='songs/11111111-1111-1111-1111-111111111111/this-task.ogg';
  const at=new Date('2026-10-24T10:11:12Z');
  const one=r2PresignedGet(path,3600,at),two=r2PresignedGet(path,3600,at);
  assert.equal(one,two,'Presigning is deterministic for a fixed timestamp');
  const parsed=new URL(one);
  assert.equal(parsed.host,mock.R2_ACCOUNT_ID+'.r2.cloudflarestorage.com');
  assert.equal(parsed.pathname,'/rhymeorbit-songs/'+path);
  assert.equal(parsed.searchParams.get('X-Amz-Date'),'20261024T101112Z');
  assert.equal(parsed.searchParams.get('X-Amz-Expires'),'3600');
  assert.match(parsed.searchParams.get('X-Amz-Signature'),/^[a-f0-9]{64}$/);
  assert.equal(one.includes(mock.R2_SECRET_ACCESS_KEY),false);
  assert.throws(()=>r2PresignedGet('songs/../../secret.mp3'));
  assert.throws(()=>r2PresignedGet('other-bucket/11111111-1111-1111-1111-111111111111/abc.mp3'));
 }finally{restore()}
});
test('Server writes audio into the private bucket using signed PUT and removes it using signed DELETE',async()=>{
 const restore=setup(),prior=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,opts)=>{
  calls.push({url:String(url),method:opts.method,headers:opts.headers,payload:opts.body});
  return {ok:true,status:200};
 };
 try{
  const path='songs/22222222-2222-2222-2222-222222222222/music.mp3';
  const bytes=Uint8Array.from({length:1002},(_,i)=>i%256).buffer;
  assert.equal(await r2Put(path,bytes,'audio/mpeg'),path);
  assert.equal(calls[0].method,'PUT');
  assert.match(calls[0].headers.Authorization,/AWS4-HMAC-SHA256 Credential=/);
  assert.match(calls[0].headers['x-amz-content-sha256'],/^[a-f0-9]{64}$/);
  assert.equal(calls[0].headers['Content-Type'],'audio/mpeg');
  assert.equal(calls[0].url,'https://'+mock.R2_ACCOUNT_ID+'.r2.cloudflarestorage.com/rhymeorbit-songs/'+path);
  assert.equal(await r2Remove(path),true);
  assert.equal(calls[1].method,'DELETE');
  assert.equal(calls.some(c=>JSON.stringify(c).includes(mock.R2_SECRET_ACCESS_KEY)),false);
  await assert.rejects(()=>r2Put(path,new Uint8Array(99).buffer,'audio/mpeg'));
 }finally{globalThis.fetch=prior;restore()}
});
