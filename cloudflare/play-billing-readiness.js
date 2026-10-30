/*
 * RhymeOrbit Google Play Billing: admin-only, READ-ONLY connectivity diagnostic.
 * Verifies that the encrypted GOOGLE_PLAY_SERVICE_ACCOUNT_JSON can mint an OAuth
 * token and read our TWO Play Console subscription product IDs. Does NOT charge,
 * acknowledge, modify subscriptions, or enable checkout.
 */
const PRODUCT_IDS=['rhymeorbit_premium','rhymeorbit_pro'];
const PACKAGE='in.rhymeorbit.app';
const json=(value,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
const safeText=async response=>response.json().catch(()=>null);
const base64url=bytes=>{
 let chars='';for(const byte of bytes)chars+=String.fromCharCode(byte);
 return btoa(chars).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
async function googleAccessToken(raw){
 const key=JSON.parse(raw);
 if(key?.type!=='service_account'||!key?.client_email?.endsWith('.iam.gserviceaccount.com')
    ||typeof key.private_key!=='string'||key.token_uri!=='https://oauth2.googleapis.com/token'){
  throw new Error('invalid-service-account-json');
 }
 const now=Math.floor(Date.now()/1000);
 const enc=new TextEncoder();
 const head=base64url(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const claim=base64url(enc.encode(JSON.stringify({
  iss:key.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',
  aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3300
 })));
 const unsigned=head+'.'+claim;
 const der=key.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g,'');
 const bytes=Uint8Array.from(atob(der),v=>v.charCodeAt(0));
 const privateKey=await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,enc.encode(unsigned));
 const assertion=unsigned+'.'+base64url(new Uint8Array(signature));
 const response=await fetch('https://oauth2.googleapis.com/token',{
  method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString(),
  signal:AbortSignal.timeout(10000)
 });
 const payload=await safeText(response);
 if(!response.ok||!payload?.access_token)throw new Error('google-oauth-rejected');
 return payload.access_token;
}
async function authorizedAdmin(request,env){
 const bearer=String(request.headers.get('authorization')||'').match(/^Bearer\s+(\S+)$/i)?.[1];
 const url=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const anon=String(env.SUPABASE_ANON_KEY||'');
 const service=String(env.SUPABASE_SERVICE_ROLE_KEY||'');
 if(!url||!anon||!service)return {error:'RhymeOrbit authentication backend unavailable',status:503};
 if(!bearer)return {error:'Sign in as a RhymeOrbit administrator',status:401};
 const who=await fetch(url+'/auth/v1/user',{
  headers:{apikey:anon,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(9000)});
 if(!who.ok)return {error:'Sign in again',status:401};
 const user=await safeText(who);
 if(!/^[a-f0-9-]{36}$/i.test(String(user?.id||''))||!user?.email_confirmed_at)
  return {error:'Verified RhymeOrbit account required',status:401};
 const admin=await fetch(url+'/rest/v1/admin_users?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id&limit=1',{
  headers:{apikey:service,Authorization:'Bearer '+service},signal:AbortSignal.timeout(9000)});
 if(!admin.ok)return {error:'Admin permissions unavailable',status:503};
 const entries=await safeText(admin);
 if(!Array.isArray(entries)||entries.length!==1)return {error:'Admins only',status:403};
 return {userId:user.id};
}
export async function handlePlayBillingReadiness(request,env){
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 let admin;
 try{admin=await authorizedAdmin(request,env)}catch{return json({error:'Backend authorization unavailable'},503)}
 if(admin.error)return json({error:admin.error},admin.status);
 if(!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)
  return json({checkoutEnabled:false,configured:false,reason:'Google Play secret not deployed'},503);
 try{
  const token=await googleAccessToken(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  const checks=await Promise.all(PRODUCT_IDS.map(async productId=>{
   const endpoint='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PACKAGE+'/subscriptions/'+productId;
   const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});
   return {productId,available:response.ok,status:response.ok?'verified':response.status===403?'permission_denied':response.status===404?'not_found':'unavailable'};
  }));
  return json({
   checkoutEnabled:false,configured:true,oauthConnected:true,
   subscriptions:checks,
   readyForCheckout:false,
   message:checks.every(x=>x.available)?'Google Play catalog connected; real checkout still requires purchase verification and lifecycle handling.':'Google Play subscription catalog needs attention.'
  });
 }catch{
  // Do not return Google error bodies, private keys, access tokens or secrets.
  return json({checkoutEnabled:false,configured:true,oauthConnected:false,error:'Could not authenticate with Google Play using the configured secret'},503);
 }
}
