import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {handlePlayBillingReadiness} from '../cloudflare/play-billing-readiness.js';

const envBase={
 SUPABASE_URL:'https://database.test',SUPABASE_ANON_KEY:'test-public',
 SUPABASE_SERVICE_ROLE_KEY:'test-server-secret'
};
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const request=(token)=>new Request('https://rhymeorbit.in/api/play-billing/readiness',{
 headers:token?{Authorization:'Bearer '+token}:{}
});
test('Google Play credential diagnostics require a verified RhymeOrbit admin',async()=>{
 const r=await handlePlayBillingReadiness(request(),envBase);
 assert.equal(r.status,401);
 const j=await r.json();
 assert.equal(j.error,'Sign in as a RhymeOrbit administrator');
});
test('Google Play credentials stay private and checkout stays off after catalog connectivity check',async()=>{
 const oldFetch=globalThis.fetch,oldCrypto=globalThis.crypto;
 if(!globalThis.crypto)globalThis.crypto=webcrypto;
 const rsa=await webcrypto.subtle.generateKey({
  name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'
 },true,['sign','verify']);
 const pkcs8=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',rsa.privateKey));
 const secret='-----BEGIN PRIVATE KEY-----\n'+pkcs8.toString('base64').match(/.{1,64}/g).join('\n')+'\n-----END PRIVATE KEY-----\n';
 const credentials=JSON.stringify({
  type:'service_account',
  client_email:'rhymeorbit-play-billing@profound-ranger-223219.iam.gserviceaccount.com',
  token_uri:'https://oauth2.googleapis.com/token',
  private_key:secret
 });
 const user='f19c2e9b-631e-45ec-843b-fae7dd458de6';
 const calls=[];
 globalThis.fetch=async (url,opts={})=>{
  const u=String(url);calls.push(u);
  if(u.endsWith('/auth/v1/user'))return respond({id:user,email_confirmed_at:'2026-10-30T00:00:00Z'});
  if(u.includes('/rest/v1/admin_users'))return respond([{user_id:user}]);
  if(u==='https://oauth2.googleapis.com/token'){
   const params=new URLSearchParams(opts.body);
   assert.equal(params.get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');
   assert.equal(params.get('assertion').split('.').length,3);
   return respond({access_token:'mock-google-access-token'});
  }
  if(u.startsWith('https://androidpublisher.googleapis.com/')){
   assert.equal(opts.headers.Authorization,'Bearer mock-google-access-token');
   return respond({productId:u.split('/').at(-1),basePlans:[]});
  }
  throw Error('Unexpected external request '+u);
 };
 try{
  const r=await handlePlayBillingReadiness(request('signed-in-admin'),{
   ...envBase,GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:credentials
  });
  assert.equal(r.status,200);
  const j=await r.json();
  assert.equal(j.checkoutEnabled,false);
  assert.equal(j.readyForCheckout,false);
  assert.equal(j.oauthConnected,true);
  assert.deepEqual(j.subscriptions.map(x=>x.productId),['rhymeorbit_premium','rhymeorbit_pro']);
  assert.ok(j.subscriptions.every(x=>x.available));
  assert.doesNotMatch(JSON.stringify(j),/PRIVATE KEY|mock-google-access-token/);
  assert.equal(calls.filter(x=>x.includes('/subscriptions/')).length,2);
 }finally{globalThis.fetch=oldFetch;if(oldCrypto===undefined)delete globalThis.crypto}
});
