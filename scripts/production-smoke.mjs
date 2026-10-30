#!/usr/bin/env node
/*
 * RhymeOrbit public production smoke test. No login, credentials, browser
 * automation or payments. Run from a machine with access to rhymeorbit.in.
 *   npm run audit:live
 *   npm run audit:live -- https://rhymeorbit.in
 */
const base=(process.argv[2]||'https://rhymeorbit.in').replace(/\/+$/,'');
if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)) {
 console.error('Provide a valid HTTPS origin, e.g. https://rhymeorbit.in');
 process.exitCode=2;
} else {
 const results=[];
 async function probe(name,path,check,options={}){
  try{
   const response=await fetch(base+path,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(12000)});
   const text=await response.text();
   const issue=check(response,text);
   results.push({name,ok:!issue,issue:issue||''});
  } catch(error){
   results.push({name,ok:false,issue:'Request failed: '+(error?.name||'network error')});
  }
 }
 await probe('Homepage /', '/', (r,s)=>{
  if(r.status!==200)return 'HTTP '+r.status;
  if(!s.includes('RhymeOrbit'))return 'Website branding missing';
  if(/FREE PUBLIC BETA|MEMBERSHIPS COMING SOON/i.test(s))return 'Outdated beta header still deployed';
  if(!s.includes('CREATE ORIGINAL MUSIC'))return 'Latest homepage markup not deployed';
  return '';
 });
 await probe('Creator Lab · 20 real tools', '/creator-lab', (r,s)=>{
  if(r.status!==200)return 'HTTP '+r.status;
  const tools=[...s.matchAll(/id="tool(\d+)"/g)].map(x=>Number(x[1]));
  if(tools.length!==20||tools.some((x,i)=>x!==i+1))return 'Expected 20 actual tool cards in production';
  if(!s.includes('/creator-lab.js'))return 'Interactive Creator Lab code is not linked';
  return '';
 });
 await probe('Install page', '/install', (r,s)=>{
  if(r.status!==200)return 'HTTP '+r.status;
  if(/Free public beta/i.test(s))return 'Outdated install copy still deployed';
  if(!s.includes('Android app is available to invited Google Play testers'))return 'Current app status copy not deployed';
  return '';
 });
 await probe('API health', '/api/health', (r,s)=>{
  if(r.status!==200)return 'HTTP '+r.status;
  try{const data=JSON.parse(s);return data?.ok===true?'':'Health endpoint does not return ok:true'}
  catch{return 'Health response is not JSON'}
 });
 await probe('Play Billing fail-closed', '/api/play-billing/status',(r,s)=>{
  if(r.status!==200)return 'HTTP '+r.status;
  try{
   const data=JSON.parse(s);
   return data?.checkoutEnabled===false?'':'Paid checkout flag unexpectedly enabled; investigate immediately';
  }catch{return 'Billing status is not JSON'}
 });
 await probe('Android Digital Asset Links', '/.well-known/assetlinks.json',(r,s)=>{
  if(r.status!==200)return 'HTTP '+r.status+'; set PLAY_APP_SIGNING_SHA256 in the Cloudflare tipun production environment';
  if(!r.headers.get('content-type')?.includes('application/json'))return 'Content-Type is not application/json';
  try{
   const links=JSON.parse(s);
   const match=links.find(x=>x?.target?.package_name==='in.rhymeorbit.app'&&
    x?.relation?.includes('delegate_permission/common.handle_all_urls')&&
    x?.target?.sha256_cert_fingerprints?.some(v=>/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(v)));
   return match?'':'Missing RhymeOrbit Android package, valid SHA-256 or app-link relation';
  }catch{return 'Digital Asset Links response is not JSON'}
 });
 for(const x of results) console.log((x.ok?'PASS':'FAIL')+' '+x.name+(x.ok?'':' — '+x.issue));
 const failed=results.filter(x=>!x.ok);
 console.log(results.length-failed.length+'/'+results.length+' checks passed.');
 if(failed.length)process.exitCode=1;
}
