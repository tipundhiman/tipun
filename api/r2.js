/* Server-side Cloudflare R2 S3 Signature V4. No secrets are sent to the browser. */
import { createHash, createHmac } from 'node:crypto';
const env=n=>(process.env[n]||'').trim();
const hash=s=>createHash('sha256').update(s).digest('hex');
const mac=(k,s)=>createHmac('sha256',k).update(s).digest();
const encode=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
export const validR2Key=key=>typeof key==='string'&&/^(songs|media)\/[a-f0-9-]{36}\/[a-zA-Z0-9_-]{1,128}\.(mp3|ogg|wav|jpg|png|webp|gif|mp4|webm)$/.test(key);
export function r2ConfigState(){
 const vals=['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'].map(env);
 if(vals.every(v=>!v))return 'not-configured';
 if(vals.some(v=>!v))return 'incomplete';
 if(!/^[a-f0-9]{32}$/i.test(vals[0])||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(vals[3]))return 'invalid';
 return 'configured';
}
export const r2Enabled=()=>r2ConfigState()==='configured';
function conf(){
 if(!r2Enabled())throw Error('Private object storage is not configured');
 return {host:env('R2_ACCOUNT_ID').toLowerCase()+'.r2.cloudflarestorage.com',
  access:env('R2_ACCESS_KEY_ID'),secret:env('R2_SECRET_ACCESS_KEY'),bucket:env('R2_BUCKET_NAME')};
}
function objectPath(c,key){
 if(!validR2Key(key))throw Error('Invalid private object key');
 return '/'+encode(c.bucket)+'/'+key.split('/').map(encode).join('/');
}
function dateStamp(d){return d.toISOString().replace(/[-:]|\.\d{3}/g,'').slice(0,15)+'Z'}
function signingKey(secret,day){return mac(mac(mac(mac('AWS4'+secret,day),'auto'),'s3'),'aws4_request')}
function sig(c,method,uri,query,headers,signedHeaders,payload,stamp){
 const day=stamp.slice(0,8);
 const request=[method,uri,query,headers,signedHeaders,payload].join('\n');
 const toSign=['AWS4-HMAC-SHA256',stamp,day+'/auto/s3/aws4_request',hash(request)].join('\n');
 return createHmac('sha256',signingKey(c.secret,day)).update(toSign).digest('hex');
}
function authorization(c,method,uri,digest,stamp){
 const headers='host:'+c.host+'\nx-amz-content-sha256:'+digest+'\nx-amz-date:'+stamp+'\n';
 const signed='host;x-amz-content-sha256;x-amz-date';
 const signature=sig(c,method,uri,'',headers,signed,digest,stamp);
 return 'AWS4-HMAC-SHA256 Credential='+c.access+'/'+stamp.slice(0,8)+'/auto/s3/aws4_request, SignedHeaders='+signed+', Signature='+signature;
}
export async function r2Put(key,bytes,mime){
 const c=conf(),length=bytes?.byteLength;
 if(!length||length<1000||length>20_000_000)throw Error('Invalid audio size');
 if(!['audio/mpeg','audio/ogg'].includes(mime))throw Error('Unsupported audio type');
 const uri=objectPath(c,key),stamp=dateStamp(new Date()),digest=hash(Buffer.from(bytes));
 const response=await fetch('https://'+c.host+uri,{
  method:'PUT',
  headers:{'Authorization':authorization(c,'PUT',uri,digest,stamp),'x-amz-content-sha256':digest,'x-amz-date':stamp,'Content-Type':mime},
  body:bytes,signal:AbortSignal.timeout(25000)
 });
 if(!response.ok)throw Error('Private audio upload failed');
 return key;
}
export function r2PresignedGet(key,seconds=3600,now=new Date()){
 const c=conf(),uri=objectPath(c,key),stamp=dateStamp(now),day=stamp.slice(0,8);
 const queryParams={
  'X-Amz-Algorithm':'AWS4-HMAC-SHA256',
  'X-Amz-Credential':c.access+'/'+day+'/auto/s3/aws4_request',
  'X-Amz-Date':stamp,'X-Amz-Expires':String(Math.max(60,Math.min(3600,Math.floor(seconds)))),
  'X-Amz-SignedHeaders':'host','X-Amz-Content-Sha256':'UNSIGNED-PAYLOAD'
 };
 const query=Object.entries(queryParams).map(([k,v])=>[encode(k),encode(v)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0).map(([k,v])=>k+'='+v).join('&');
 const signature=sig(c,'GET',uri,query,'host:'+c.host+'\n','host','UNSIGNED-PAYLOAD',stamp);
 return 'https://'+c.host+uri+'?'+query+'&X-Amz-Signature='+signature;
}
export async function r2Remove(key){
 const c=conf(),uri=objectPath(c,key),stamp=dateStamp(new Date()),digest=hash('');
 const response=await fetch('https://'+c.host+uri,{
  method:'DELETE',
  headers:{Authorization:authorization(c,'DELETE',uri,digest,stamp),'x-amz-content-sha256':digest,'x-amz-date':stamp},
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok&&response.status!==404)throw Error('Private audio removal failed');
 return true;
}
