import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../api/index.js';

const userId='0b8fde5b-530b-4016-8c39-ac6c9eeed46f';
const taskId='3e859cad-871d-45d7-8483-c9ac0e868634';
const audio=Buffer.from('OggS-test-audio-bytes-for-range-playback');

function fakeResponse(data,status=200,headers={}){
  return {ok:status>=200&&status<300,status,headers:new Headers(headers),
    async json(){return data},async text(){return JSON.stringify(data)}};
}
async function call(url,headers={}){
  const req={method:'GET',url,headers,socket:{remoteAddress:'127.0.0.1'}};
  let status=200,responseHeaders={},body;
  const res={writeHead(code,h={}){status=code;responseHeaders=h},end(b){body=b}};
  await handleApi(req,res);
  return {status,headers:responseHeaders,body:Buffer.isBuffer(body)?body:JSON.parse(String(body))};
}

test('R2 audio streams in private 206 byte ranges without exposing the R2 URL',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY',
    'R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{
    SUPABASE_URL:'https://database.test',SUPABASE_ANON_KEY:'mock-anon',
    SUPABASE_SERVICE_ROLE_KEY:'mock-private-service-key',
    R2_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',R2_ACCESS_KEY_ID:'test-access',
    R2_SECRET_ACCESS_KEY:'test-secret',R2_BUCKET_NAME:'rhymeorbit-songs'
  });
  const originalFetch=globalThis.fetch;
  let rangeRequests=0;
  globalThis.fetch=async(url,opts={})=>{
    const target=String(url);
    if(target.includes('/auth/v1/user'))return fakeResponse({id:userId});
    if(target.includes('/rest/v1/ro_account_ages'))return fakeResponse([{user_id:userId}]);
    if(target.includes('/rest/v1/generated_songs')){
      return fakeResponse([{task_id:taskId,title:'Test song',voice:'male',status:'ready',
        storage_path:`r2:songs/${userId}/${taskId}.ogg`,created_at:'2026-10-24T09:02:00Z'}]);
    }
    if(target.includes('r2.cloudflarestorage.com')){
      rangeRequests++;
      const match=/^bytes=(\d+)-(\d+)$/.exec(opts.headers.Range);
      assert.ok(match,'R2 is requested with a bounded byte range');
      const start=Number(match[1]),end=Math.min(Number(match[2]),audio.length-1);
      const bytes=audio.subarray(start,end+1);
      return {ok:true,status:206,headers:new Headers({
        'Content-Type':'audio/ogg','Content-Range':`bytes ${start}-${end}/${audio.length}`}),
        async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}};
    }
    throw Error('Unexpected URL '+target);
  };
  try{
    const library=await call('/api/music/library',{authorization:'Bearer signed-in-user'});
    assert.equal(library.status,200);
    const item=library.body.items[0];
    assert.ok(item.proxyUrl.startsWith('/api/music/audio/'+taskId+'?token='));
    assert.equal(item.cloudSaved,true);
    assert.match(item.url,/r2\.cloudflarestorage\.com/);

    const first=await call(item.proxyUrl,{range:'bytes=0-9'});
    assert.equal(first.status,206);
    assert.equal(first.headers['Content-Range'],`bytes 0-9/${audio.length}`);
    assert.deepEqual(first.body,audio.subarray(0,10));
    assert.equal(first.headers['Content-Type'],'audio/ogg');

    const next=await call(item.proxyUrl,{range:'bytes=10-'});
    assert.equal(next.status,206);
    assert.deepEqual(next.body,audio.subarray(10));
    assert.equal(rangeRequests,2);

    const tampered=await call(item.proxyUrl.replace(taskId,'not-the-task'));
    assert.equal(tampered.status,401,'Token cannot be reused for another song');
    const missing=await call(`/api/music/audio/${taskId}`);
    assert.equal(missing.status,401,'Unsigned requests cannot stream private songs');
    assert.equal(rangeRequests,2,'Invalid requests never reach R2');
  }finally{
    globalThis.fetch=originalFetch;
    for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}
  }
});
