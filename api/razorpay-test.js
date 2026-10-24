/* RhymeOrbit Razorpay TEST sandbox. Real collections and paid entitlements stay disabled. */
import {createHmac,timingSafeEqual} from 'node:crypto';

export const testPrices=Object.freeze({
 premium:Object.freeze({monthly:59900,annual:658800}),
 pro:Object.freeze({monthly:129900,annual:1438800})
});
const env=name=>(process.env[name]||'').trim();
const testKeys=()=>({
 id:env('RAZORPAY_TEST_KEY_ID'),
 secret:env('RAZORPAY_TEST_KEY_SECRET'),
 webhook:env('RAZORPAY_TEST_WEBHOOK_SECRET')
});
export const testKeyConfigured=()=>{
 const k=testKeys();
 return /^rzp_test_[A-Za-z0-9]+$/.test(k.id)&&k.secret.length>=8&&k.webhook.length>=8;
};
const planVar=(plan,cycle)=>'RAZORPAY_TEST_'+plan.toUpperCase()+'_'+cycle.toUpperCase()+'_PLAN_ID';
function planMatchesGateway(vendor,choice){
 const amount=Number(vendor.item?.amount??vendor.item?.unit_amount);
 return vendor.id===choice.planId&&
  vendor.period===(choice.cycle==='annual'?'yearly':'monthly')&&
  Number(vendor.interval)===1&&amount===choice.pricePaise&&
  vendor.item?.currency==='INR';
}
/** Explicit safe error categories, never expose Razorpay's raw response or credentials. */
export function sandboxGatewayError(err){
 const status=Number(err?.gatewayStatus||0);
 if(status===401)return 'Razorpay rejected the TEST API Key ID or Secret (401). Regenerate the TEST key pair in the same account as your plans, then update Vercel Production.';
 if(status===403)return 'Razorpay account/API key does not have access to this subscription plan (403). Check merchant account permissions.';
 if(status===404)return 'Plan ID not found in this Razorpay TEST account (404). Copy the plan_... ID from Test Mode → Subscriptions → Plans.';
 if(status===400||status===422)return 'Razorpay rejected the plan lookup request ('+status+'). Check account mode and plan ID.';
 if(status===429)return 'Razorpay temporarily limited the requests (429). Try again after a short break.';
 if(status>=500)return 'Razorpay server is temporarily unavailable ('+status+'). Try again later.';
 if(err?.name==='TimeoutError'||err?.name==='AbortError')return 'Razorpay API request timed out. Retry after checking network status.';
 return 'Could not contact Razorpay. Confirm your test keys and plan IDs are from the same Razorpay account.';
}
function chosenPlan(plan,cycle){
 if(!Object.hasOwn(testPrices,plan)||!Object.hasOwn(testPrices[plan],cycle))return null;
 const planId=env(planVar(plan,cycle));
 if(!/^plan_[A-Za-z0-9]+$/.test(planId))return null;
 return {plan,cycle,planId,pricePaise:testPrices[plan][cycle]};
}
export function safeHmac(secret,input){
 return createHmac('sha256',secret).update(input).digest('hex');
}
export function constantSignature(expected,provided){
 if(!/^[a-f0-9]{64}$/i.test(String(provided||'')))return false;
 const a=Buffer.from(expected,'hex'),b=Buffer.from(String(provided),'hex');
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function verifyTestCheckoutSignature({paymentId,subscriptionId,signature}){
 const {secret}=testKeys();
 if(!secret||!/^pay_[A-Za-z0-9]+$/.test(paymentId)||!/^sub_[A-Za-z0-9]+$/.test(subscriptionId))return false;
 return constantSignature(safeHmac(secret,paymentId+'|'+subscriptionId),signature);
}

async function razorpayRequest(method,endpoint,data){
 const k=testKeys();
 if(!/^rzp_test_[A-Za-z0-9]+$/.test(k.id)||!k.secret)
   throw new Error('Razorpay test credentials are not configured');
 const response=await fetch('https://api.razorpay.com/v1'+endpoint,{
  method,
  headers:{Authorization:'Basic '+Buffer.from(k.id+':'+k.secret).toString('base64'),
   'Content-Type':'application/json'},
  ...(data?{body:JSON.stringify(data)}:{}),
  signal:AbortSignal.timeout(12000)
 });
 const value=await response.json().catch(()=>({}));
 if(!response.ok){
  const error=new Error('Razorpay test gateway request rejected');
  error.gatewayStatus=response.status;
  throw error;
 }
 return value;
}

export async function handleTestBilling(req,res,{path,send,auth,isAdmin,supaFetch,body,rate}){
 const validPaths=new Set([
  '/api/billing/test/status','/api/billing/test/create-subscription',
  '/api/billing/test/verify','/api/billing/test/subscriptions','/api/billing/test/diagnose'
 ]);
 if(!validPaths.has(path))return false;
 if(!rate(req,res))return true;
 const user=await auth(req,res);if(!user)return true;
 if(!await isAdmin(user.id)){send(res,403,{error:'Razorpay sandbox is for authorized admins only'});return true}
 const dbCheck=()=>supaFetch('/rest/v1/billing_test_subscriptions?select=id&limit=0');

 if(req.method==='GET'&&path==='/api/billing/test/status'){
  const database=await dbCheck();
  const plans={};
  for(const plan of Object.keys(testPrices)){
   plans[plan]={};
   for(const cycle of Object.keys(testPrices[plan]))plans[plan][cycle]=Boolean(chosenPlan(plan,cycle));
  }
  return send(res,200,{
   testMode:true,livePaymentsEnabled:false,grantsPaidSongCredits:false,
   configured:testKeyConfigured()&&database.ok,
   databaseReady:database.ok,keyReady:testKeyConfigured(),
   availablePlans:plans,
   checkoutKeyId:testKeyConfigured()?testKeys().id:null,
   note:'Sandbox transactions only. Paid song entitlements are disabled.'
  }),true;
 }
 if(req.method==='GET'&&path==='/api/billing/test/diagnose'){
  const db=await dbCheck();
  const settings={
   keyIdHasTestPrefix:/^rzp_test_[A-Za-z0-9]+$/.test(testKeys().id),
   apiSecretSet:testKeys().secret.length>0,
   webhookSecretSet:testKeys().webhook.length>0,
   databaseReady:db.ok
  };
  const checked=[];
  for(const plan of ['premium','pro']){
   for(const cycle of ['monthly','annual']){
    const choice=chosenPlan(plan,cycle);
    if(!choice)continue;
    try{
     const vendor=await razorpayRequest('GET','/plans/'+encodeURIComponent(choice.planId));
     checked.push({
      plan,cycle,
      match:planMatchesGateway(vendor,choice),
      result:planMatchesGateway(vendor,choice)?'Verified':'Plan details differ from RhymeOrbit pricing or billing frequency. Check amount and interval in Razorpay.'
     });
    }catch(error){
     checked.push({plan,cycle,match:false,result:sandboxGatewayError(error)});
    }
   }
  }
  send(res,200,{
   testMode:true,realPaymentsEnabled:false,
   settings,plans:checked,
   message:!settings.keyIdHasTestPrefix||!settings.apiSecretSet?
    'Razorpay TEST API key pair is missing or has an invalid format in Vercel Production.':
    !settings.webhookSecretSet?
    'Webhook signing secret missing. Add RAZORPAY_TEST_WEBHOOK_SECRET before opening checkout.':
    checked.length===0?'No valid plan_... identifiers configured for testing.':
    checked.every(x=>x.match)?'All configured Razorpay test plans verified.':
    'One or more plans could not be verified. See each result.'
  });
  return true;
 }
 if(req.method==='GET'&&path==='/api/billing/test/subscriptions'){
  const result=await supaFetch('/rest/v1/billing_test_subscriptions?user_id=eq.'+
   encodeURIComponent(user.id)+'&select=id,plan,cycle,status,created_at,updated_at&order=created_at.desc&limit=20');
  return send(res,result.ok?200:503,result.ok?{items:result.data}:{error:'Sandbox records unavailable'}),true;
 }
 if(req.method==='POST'&&path==='/api/billing/test/create-subscription'){
  if(!testKeyConfigured()){send(res,503,{error:'Razorpay test credentials or webhook secret are missing'});return true}
  const input=await body(req);
  const choice=chosenPlan(String(input.plan||''),String(input.cycle||''));
  if(!choice){send(res,400,{error:'Select a configured Razorpay test plan'});return true}
  const table=await dbCheck();
  if(!table.ok){send(res,503,{error:'Sandbox database is not ready'});return true}
  // The server checks the Razorpay plan itself. Never accept the amount from the browser.
  let vendorPlan;
  try{vendorPlan=await razorpayRequest('GET','/plans/'+encodeURIComponent(choice.planId))}
  catch(error){send(res,503,{error:sandboxGatewayError(error)});return true}
  if(!planMatchesGateway(vendorPlan,choice)){
    send(res,409,{error:'Razorpay test plan amount or billing frequency does not match the pricing page'});
    return true;
  }
  let subscription;
  try{
   subscription=await razorpayRequest('POST','/subscriptions',{
    plan_id:choice.planId,total_count:choice.cycle==='annual'?2:12,
    quantity:1,customer_notify:false,
    notes:{rhymeorbit_test_user:user.id,plan:choice.plan,cycle:choice.cycle}
   });
  }catch{
   send(res,502,{error:'Could not create test subscription. No live payment was collected'});
   return true;
  }
  const sid=String(subscription.id||'');
  if(!/^sub_[A-Za-z0-9]+$/.test(sid)||subscription.plan_id!==choice.planId){
   send(res,502,{error:'Gateway returned an unexpected sandbox subscription'});
   return true;
  }
  const record=await supaFetch('/rest/v1/billing_test_subscriptions',{
   method:'POST',headers:{Prefer:'return=minimal'},
   body:JSON.stringify({id:sid,user_id:user.id,plan:choice.plan,cycle:choice.cycle,
    razorpay_plan_id:choice.planId,status:'created'})
  });
  if(!record.ok){
   // Fail closed: no checkout unless the row can be tracked. Orphan TEST-only
   // subscriptions may be canceled manually from the Razorpay Test Dashboard.
   send(res,503,{error:'Test subscription could not be stored. Checkout was not opened'});
   return true;
  }
  send(res,200,{
   testMode:true,subscriptionId:sid,keyId:testKeys().id,
   plan:choice.plan,cycle:choice.cycle,
   note:'Sandbox only: test payments do not unlock paid benefits.'
  });
  return true;
 }
 if(req.method==='POST'&&path==='/api/billing/test/verify'){
  const data=await body(req);
  const paymentId=String(data.razorpay_payment_id||'');
  const subscriptionId=String(data.razorpay_subscription_id||'');
  const signature=String(data.razorpay_signature||'');
  if(!verifyTestCheckoutSignature({paymentId,subscriptionId,signature})){
   send(res,401,{error:'Invalid Razorpay test checkout signature'});return true;
  }
  const found=await supaFetch('/rest/v1/billing_test_subscriptions?user_id=eq.'+
   encodeURIComponent(user.id)+'&id=eq.'+encodeURIComponent(subscriptionId)+'&select=id&limit=1');
  if(!found.ok){send(res,503,{error:'Sandbox record unavailable'});return true}
  if(!found.data?.length){send(res,404,{error:'Test subscription not found in your account'});return true}
  // Checkout verification is NOT paid activation; only signed server webhooks are logged.
  send(res,200,{verified:true,testMode:true,paidBenefitsEnabled:false,
   note:'Test authorization verified. Await signed Razorpay webhooks in the sandbox ledger.'});
  return true;
 }
 send(res,405,{error:'Method not supported'});return true;
}

export async function readRawWebhook(req,maxLength=131072){
 if(Buffer.isBuffer(req.rawBody))return req.rawBody;
 if(typeof req.rawBody==='string')return Buffer.from(req.rawBody);
 // Never access the Vercel req.body getter here: it may parse/consume the stream.
 const chunks=[];let total=0;
 for await(const chunk of req){
  const next=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  total+=next.length;
  if(total>maxLength)throw new Error('Webhook too large');
  chunks.push(next);
 }
 return Buffer.concat(chunks);
}

export async function handleTestWebhook(req,res){
 const send=(code,body)=>{
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(body));
 };
 if(req.method!=='POST'){send(405,{error:'Method not allowed'});return}
 const k=testKeys();
 if(!testKeyConfigured()){send(503,{error:'Test webhook is not configured'});return}
 let raw;
 try{raw=await readRawWebhook(req)}
 catch{send(400,{error:'Unable to read signed webhook body'});return}
 if(raw.length>131072){send(413,{error:'Webhook too large'});return}
 const signature=String(req.headers['x-razorpay-signature']||'');
 if(!constantSignature(safeHmac(k.webhook,raw),signature)){
  send(401,{error:'Invalid webhook signature'});return;
 }
 const eventId=String(req.headers['x-razorpay-event-id']||'');
 if(eventId.length<5||eventId.length>180){send(400,{error:'Missing webhook event identifier'});return}
 let payload;
 try{payload=JSON.parse(raw.toString('utf8'))}catch{send(400,{error:'Invalid signed JSON'});return}
 const eventName=String(payload.event||'');
 const entity=payload.payload?.subscription?.entity;
 if(!eventName.startsWith('subscription.')||!entity){
  send(200,{received:true,ignored:true});return;
 }
 const id=String(entity.id||''),planId=String(entity.plan_id||'');
 const status=String(entity.status||eventName.slice('subscription.'.length)).toLowerCase();
 const createdAt=Number(payload.created_at);
 if(!/^sub_[A-Za-z0-9]+$/.test(id)||!/^plan_[A-Za-z0-9]+$/.test(planId)||
   !/^[a-z_]+$/.test(status)||!Number.isSafeInteger(createdAt)||createdAt<=0){
  send(400,{error:'Invalid signed subscription event'});return;
 }
 const url=env('SUPABASE_URL').replace(/\/$/,'');
 const secret=env('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!secret){send(503,{error:'Sandbox ledger unavailable'});return}
 let result;
 try{
  const response=await fetch(url+'/rest/v1/rpc/ro_record_test_razorpay_event',{
   method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},
   body:JSON.stringify({p_event_id:eventId,p_subscription_id:id,p_plan_id:planId,
    p_event_type:eventName,p_status:status,p_event_at:new Date(createdAt*1000).toISOString()}),
   signal:AbortSignal.timeout(10000)
  });
  if(!response.ok){send(503,{error:'Could not record signed sandbox webhook'});return}
  result=await response.json();
 }catch{send(503,{error:'Sandbox webhook ledger temporarily unavailable'});return}
 send(200,{received:true,testMode:true,tracked:result?.tracked===true,duplicate:result?.duplicate===true});
}
