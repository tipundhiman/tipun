import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {testPrices,testKeyConfigured,safeHmac,verifyTestCheckoutSignature,handleTestBilling,handleTestWebhook,sandboxGatewayError,compareSandboxPlan} from '../api/razorpay-test.js';

const keys=['RAZORPAY_TEST_KEY_ID','RAZORPAY_TEST_KEY_SECRET','RAZORPAY_TEST_WEBHOOK_SECRET','RAZORPAY_TEST_PREMIUM_MONTHLY_PLAN_ID','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
const data={
 RAZORPAY_TEST_KEY_ID:'rzp_test_TestKey123',
 RAZORPAY_TEST_KEY_SECRET:'test-only-secret',
 RAZORPAY_TEST_WEBHOOK_SECRET:'test-webhook-secret',
 RAZORPAY_TEST_PREMIUM_MONTHLY_PLAN_ID:'plan_TestPremiumM',
 SUPABASE_URL:'https://test-db.example.net',SUPABASE_SERVICE_ROLE_KEY:'test-db-secret'
};
function setup(){const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,data);return()=>{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}}}
function req(method,path,payload){
 return {method,url:path,headers:{},socket:{remoteAddress:'127.0.0.1'},
  async *[Symbol.asyncIterator](){if(payload)yield Buffer.from(JSON.stringify(payload))}};
}
function res(){return {status:0,body:null,writeHead(status){this.status=status},end(text){this.body=JSON.parse(text)}}}
function ctx(isAdmin=true){
 const calls=[];
 return {calls,path:'/api/billing/test/create-subscription',send:(res,status,body)=>{res.status=status;res.body=body},
 rate:()=>true,auth:async()=>({id:'11111111-1111-1111-1111-111111111111'}),
 isAdmin:async()=>isAdmin,body:async req=>{const data=[];for await(const c of req)data.push(c);return JSON.parse(Buffer.concat(data).toString())},
 supaFetch:async(url,opts={})=>{calls.push({url,opts});if(opts.method==='POST')return {ok:true};
  return {ok:true,data:url.includes('user_id=')?[{id:'sub_Test123'}]:[]}}};
}
test('Only test keys are accepted and real payments stay off',()=>{
 const end=setup();
 try{assert.equal(testKeyConfigured(),true);process.env.RAZORPAY_TEST_KEY_ID='rzp_live_NotAllowed';assert.equal(testKeyConfigured(),false)}
 finally{end()}
});
test('Checkout HMAC accepts valid response and rejects tampering',()=>{
 const end=setup();
 try{const signature=createHmac('sha256','test-only-secret').update('pay_ABC123|sub_Test123').digest('hex');
 assert.equal(verifyTestCheckoutSignature({paymentId:'pay_ABC123',subscriptionId:'sub_Test123',signature}),true);
 assert.equal(verifyTestCheckoutSignature({paymentId:'pay_ABC123',subscriptionId:'sub_Test123',signature:'0'.repeat(64)}),false)}
 finally{end()}
});
test('Unprivileged users cannot initiate test payments',async()=>{
 const end=setup(),prior=globalThis.fetch;let upstream=0;
 globalThis.fetch=async()=>{upstream++;throw Error('must not call Razorpay')};
 try{const r=res();await handleTestBilling(req('POST','/api/billing/test/create-subscription',{plan:'premium',cycle:'monthly'}),r,ctx(false));assert.equal(r.status,403);assert.equal(upstream,0)}
 finally{globalThis.fetch=prior;end()}
});
test('Server independently checks Razorpay price before creating any subscription',async()=>{
 const end=setup(),prior=globalThis.fetch,requests=[];
 globalThis.fetch=async(url,opts)=>{
  requests.push({url:String(url),method:opts.method,body:opts.body});
  return {ok:true,async json(){
   if(String(url).includes('/plans/'))return {id:'plan_TestPremiumM',period:'monthly',interval:1,item:{amount:59900,currency:'INR'}};
   return {id:'sub_Test123',plan_id:'plan_TestPremiumM',status:'created'};
  }};
 };
 try{
  const r=res(),context=ctx();
  await handleTestBilling(req('POST','/api/billing/test/create-subscription',{plan:'premium',cycle:'monthly'}),r,context);
  assert.equal(r.status,200);assert.equal(r.body.testMode,true);
  assert.equal(requests.length,2);
  assert.equal(JSON.parse(requests[1].body).customer_notify,false);
  assert.equal(JSON.parse(requests[1].body).total_count,12);
  assert.ok(context.calls.some(x=>x.opts.method==='POST'));
 }finally{globalThis.fetch=prior;end()}
});
test('Wrong price stops checkout and no vendor subscription is created',async()=>{
 const end=setup(),prior=globalThis.fetch,requests=[];
 globalThis.fetch=async url=>{
  requests.push(String(url));
  return {ok:true,async json(){return {id:'plan_TestPremiumM',period:'monthly',interval:1,item:{amount:1,currency:'INR'}}}};
 };
 try{const r=res();await handleTestBilling(req('POST','/api/billing/test/create-subscription',{plan:'premium',cycle:'monthly'}),r,ctx());assert.equal(r.status,409);assert.equal(requests.length,1)}
 finally{globalThis.fetch=prior;end()}
});
test('Raw webhook signature checked before touching database; only test ledger RPC is used',async()=>{
 const end=setup(),prior=globalThis.fetch,calls=[];
 const event={event:'subscription.activated',created_at:1792828800,payload:{subscription:{entity:{id:'sub_Test123',plan_id:'plan_TestPremiumM',status:'active'}}}};
 const body=JSON.stringify(event);
 const hook={method:'POST',headers:{'x-razorpay-event-id':'evt_Test123','x-razorpay-signature':'invalid'},
  async *[Symbol.asyncIterator](){yield Buffer.from(body)}};
 globalThis.fetch=async(url,opts)=>{
  calls.push({url:String(url),payload:JSON.parse(opts.body)});
  return {ok:true,async json(){return {tracked:true,duplicate:false}}};
 };
 try{
  let result=res();await handleTestWebhook(hook,result);assert.equal(result.status,401);assert.equal(calls.length,0);
  hook.headers['x-razorpay-signature']=safeHmac('test-webhook-secret',Buffer.from(body));
  result=res();await handleTestWebhook(hook,result);assert.equal(result.status,200);assert.equal(result.body.tracked,true);
  assert.equal(calls.length,1);assert.ok(calls[0].url.includes('rpc/ro_record_test_razorpay_event'));
 }finally{globalThis.fetch=prior;end()}
});
test('Sandbox never gives live subscriptions or song credits',async()=>{
 assert.equal(testPrices.premium.monthly,59900);
 assert.equal(testPrices.pro.annual,1438800);
 const {readFileSync}=await import('node:fs');
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const mod=readFileSync(new URL('../api/razorpay-test.js',import.meta.url),'utf8');
 assert.match(api,/const limit = !active \? 0 : !s \|\| s\.plan === 'free' \? 3 : paidLimit;/);
 assert.match(api,/const paidCap = s\?\.plan === 'pro' \? 75 : s\?\.plan === 'premium' \? 35 : 0;/);
 assert.doesNotMatch(mod,/public\.subscriptions/);
});

test('Admin diagnostic identifies the exact TEST-plan lookup problem without exposing secrets',async()=>{
 const end=setup(),prior=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return {ok:false,status:401,async json(){return {error:{description:'private gateway hint'}}}}};
 try{
  const r=res(),context={...ctx(),path:'/api/billing/test/diagnose'};
  await handleTestBilling(req('GET','/api/billing/test/diagnose'),r,context);
  assert.equal(r.status,200);assert.equal(r.body.testMode,true);
  assert.equal(r.body.plans.length,1);
  assert.equal(r.body.plans[0].match,false);
  assert.match(r.body.plans[0].result,/TEST API Key ID or Secret \(401\)/);
  assert.equal(calls.length,1);
  assert.doesNotMatch(JSON.stringify(r.body),/test-only-secret|private gateway hint/);
 }finally{globalThis.fetch=prior;end()}
});
test('Checkout returns actionable 404 plan lookup hint and never creates a subscription',async()=>{
 const end=setup(),prior=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return {ok:false,status:404,async json(){return {}}}};
 try{
  const r=res();
  await handleTestBilling(req('POST','/api/billing/test/create-subscription',{plan:'premium',cycle:'monthly'}),r,ctx());
  assert.equal(r.status,503);
  assert.match(r.body.error,/Plan ID not found.*TEST account \(404\)/);
  assert.equal(calls.length,1);
 }finally{globalThis.fetch=prior;end()}
});
test('Non-admin user cannot run plan diagnosis',async()=>{
 const end=setup(),prior=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests++;throw Error('Must not contact gateway')};
 try{
  const r=res();
  await handleTestBilling(req('GET','/api/billing/test/diagnose'),r,{...ctx(false),path:'/api/billing/test/diagnose'});
  assert.equal(r.status,403);assert.equal(requests,0);
 }finally{globalThis.fetch=prior;end()}
});

test('Mismatch diagnostic shows the exact amount, period, interval and currency without any keys',()=>{
 const chosen={plan:'premium',cycle:'monthly',planId:'plan_TestPremiumM',pricePaise:59900};
 const vendor={
  id:'plan_TestPremiumM',period:'weekly',interval:2,
  item:{amount:49900,currency:'USD'}
 };
 const result=compareSandboxPlan(vendor,chosen);
 assert.equal(result.match,false);
 assert.match(result.message,/Amount: expected ₹599\.00, received ₹499\.00/);
 assert.match(result.message,/Billing period: expected monthly, received weekly/);
 assert.match(result.message,/Billing interval: expected 1, received 2/);
 assert.match(result.message,/Currency: expected INR, received USD/);
 assert.ok(!result.message.includes('plan_TestPremiumM'),'No internal plan ID should be shown');
});
test('Correct test price and cycle continue to be verified',()=>{
 const chosen={plan:'pro',cycle:'monthly',planId:'plan_Valid',pricePaise:129900};
 const verified=compareSandboxPlan({
  id:'plan_Valid',period:'monthly',interval:1,item:{amount:129900,currency:'INR'}
 },chosen);
 assert.deepEqual(verified.match,true);
 assert.equal(verified.message,'Verified');
});
test('Missing Razorpay fields fail closed without exposing untrusted API content',()=>{
 const chosen={plan:'premium',cycle:'monthly',planId:'plan_TestPremiumM',pricePaise:59900};
 const result=compareSandboxPlan({},chosen);
 assert.equal(result.match,false);
 assert.match(result.message,/Amount: expected ₹599\.00, received Missing or invalid/);
 assert.match(result.message,/Billing period: expected monthly, received missing/);
});
test('Admin diagnose displays exact sanitized mismatches without triggering a checkout',async()=>{
 const end=setup(), prior=globalThis.fetch, calls=[];
 globalThis.fetch=async(url,opts)=>{
  calls.push({url:String(url),method:opts.method});
  return {ok:true,async json(){return{
   id:'plan_TestPremiumM',period:'monthly',interval:1,
   item:{amount:49900,currency:'INR'}
  }}};
 };
 try{
  const r=res(),c={...ctx(),path:'/api/billing/test/diagnose'};
  await handleTestBilling(req('GET','/api/billing/test/diagnose'),r,c);
  assert.equal(r.status,200);
  assert.match(r.body.plans[0].result,/Amount: expected ₹599\.00, received ₹499\.00/);
  assert.deepEqual(calls.map(x=>x.method),['GET']);
  assert.ok(!JSON.stringify(r.body).includes('plan_TestPremiumM'));
 }finally{globalThis.fetch=prior;end()}
});
