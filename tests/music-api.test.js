import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../api/index.js';

function response(data,status=200,headers={}){
 return {status,ok:status>=200&&status<300,
  headers:{get:key=>headers[key.toLowerCase()]||null},
  async json(){return data},
  async text(){return JSON.stringify(data)},
  async arrayBuffer(){return new ArrayBuffer(3000)}};
}
function request(method,url,payload,session='test-user'){
 let status,body;
 const req={method,url,headers:{authorization:'Bearer '+session,'x-forwarded-for':'203.0.113.77'},socket:{remoteAddress:'203.0.113.77'},
  async *[Symbol.asyncIterator](){if(payload)yield Buffer.from(JSON.stringify(payload))}};
 const res={writeHead(code){status=code},end(x){body=JSON.parse(x)}};
 return handleApi(req,res).then(()=>({status,body}));
}
test('Public song API enforces 3 credits, ownership, vocal payload and no provider-brand leakage',async()=>{
 const originalFetch=globalThis.fetch,old={};
 const keys=['TREBLO_API_KEY','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','PUBLIC_MUSIC_GENERATION_ENABLED'];
 for(const k of keys)old[k]=process.env[k];
 Object.assign(process.env,{TREBLO_API_KEY:'mock-provider-key',SUPABASE_URL:'https://database.test',
   SUPABASE_ANON_KEY:'mock-anon-key',SUPABASE_SERVICE_ROLE_KEY:'mock-service-key',PUBLIC_MUSIC_GENERATION_ENABLED:'true'});
 let providerSubmits=[],providerStatusChecks=0,reservations=0,refunds=0,quotaExhausted=false,upstreamFail=false,adminMode=false,libraryRecordsCreated=0;
 globalThis.fetch=async(url,opts={})=>{
  const u=String(url);
  if(u.includes('/auth/v1/user'))return response({id:'user-a'});
  if(u.includes('/rest/v1/admin_users'))return response(adminMode?[{user_id:'user-a'}]:[]);
  if(u.includes('/rest/v1/music_generation_reservations')){
    return response(u.includes('task_id=eq.owned_task')?[{id:'reservation-a'}]:[]);
  }
  if(u.includes('/rest/v1/subscriptions'))return response([{plan:'premium',status:'active',monthly_song_limit:100}]);
  if(u.includes('/rest/v1/music_usage'))return response([{songs_used:0,songs_reserved:0}]);
  if(u.includes('/rest/v1/generated_songs')){if(opts.method==='POST')libraryRecordsCreated++;return response([])};
  if(u.includes('/storage/v1/bucket/song-audio'))return response({id:'song-audio'});
  if(u.includes('/rest/v1/rpc/ro_reserve_song')){reservations++;return quotaExhausted?response({message:'song quota exhausted'},400):response('reservation-a')}
  if(u.includes('/rest/v1/rpc/ro_finish_song'))return response(true);
  if(u.includes('/rest/v1/rpc/ro_refund_failed_song')){refunds++;return response(true)}
  if(u.includes('/v1/generations/v3')){providerSubmits.push(JSON.parse(opts.body));return response({task_id:'owned_task'})}
  if(u.includes('/v1/generations/status/')){providerStatusChecks++;return response({status:upstreamFail?'FAILURE':'SUCCESS'})}
  if(u.includes('/v1/generations/owned_task'))return response({song_paths:['https://cdn.example/song.ogg']});
  throw Error('Unexpected external request: '+u);
 };
 try{
  const status=await request('GET','/api/music/status');
  assert.equal(status.status,200);
  assert.equal(status.body.publicGenerationEnabled,true);
  assert.equal(status.body.provider,undefined);
  assert.equal(status.body.freeMonthlySongs,3);
  const credits=await request('GET','/api/music/credits');
  assert.equal(credits.status,200);
  assert.equal(credits.body.monthlyLimit,3);
  assert.equal(credits.body.remaining,3);
  const unconfirmed=await request('POST','/api/music/generate',{lyrics:'A sweet Hindi love song about the rain'});
  assert.equal(unconfirmed.status,400,'Copyright declaration is required');
  assert.equal(reservations,0,'No credits charged without rights confirmation');
  const idea=await request('POST','/api/music/generate',{lyrics:'A sweet Hindi love song about the rain',genre:'Pop',mood:'Romantic',language:'Hindi',rightsConfirmed:true,title:'Rain Song'});
  assert.equal(idea.status,200);
  assert.equal(idea.body.id,'owned_task');
  assert.equal(providerSubmits[0].instrumental,false);
  assert.ok(!Object.hasOwn(providerSubmits[0],'lyrics'),'Idea mode must ask provider to write original lyrics');
  const full=await request('POST','/api/music/generate',{lyrics:'[Verse]\nLove is in the air\n[Chorus]\nSing about our lovely day',prompt:'Acoustic song',rightsConfirmed:true});
  assert.equal(full.status,200);
  assert.ok(providerSubmits[1].lyrics.startsWith('[Verse]'));
  assert.equal(reservations,2);
  assert.equal(libraryRecordsCreated,2,'Pending songs must be stored in the cloud library at submission');
  const other=await request('GET','/api/music/prediction/not_my_task');
  assert.equal(other.status,404);
  assert.equal(providerStatusChecks,0);
  const mine=await request('GET','/api/music/prediction/owned_task');
  assert.equal(mine.status,200);
  assert.equal(mine.body.status,'succeeded');
  const unauthorizedSave=await request('POST','/api/music/library',{taskId:'not_my_task'});
  assert.equal(unauthorizedSave.status,404);
  upstreamFail=true;
  const failure=await request('GET','/api/music/prediction/owned_task');
  assert.equal(failure.body.status,'failed');
  assert.equal(refunds,1);
  quotaExhausted=true;
  const blocked=await request('POST','/api/music/generate',{lyrics:'One more rain song',rightsConfirmed:true});
  assert.equal(blocked.status,403);
  assert.equal(providerSubmits.length,2,'Quota failure must not initiate paid generation');
  adminMode=true;
  const diagnostic=await request('GET','/api/admin/music-readiness');
  assert.equal(diagnostic.status,200);
  assert.equal(diagnostic.body.ready,true);
  assert.equal(diagnostic.body.isAdmin,true);
  assert.deepEqual(diagnostic.body.blockers,[]);
  assert.equal(diagnostic.body.estimatedCostUsd,null);
 }finally{
  globalThis.fetch=originalFetch;
  for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}
 }
});
