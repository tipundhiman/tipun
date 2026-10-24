import test from 'node:test';
import assert from 'node:assert/strict';
import {forwardApiRequest} from '../cloudflare/api-adapter.js';
import {handleApi} from '../api/index.js';

const site='https://tipun.dtipun.workers.dev';
const user='11111111-1111-1111-1111-111111111111';
const task='song_native_binding';
const key=`songs/${user}/${task}.mp3`;
const song=Buffer.from('ID3-test-private-audio-'.repeat(100));
const fakeResponse=(data,status=200)=>({ok:status>=200&&status<300,status,
  async json(){return data},async text(){return JSON.stringify(data)}});

test('existing Cloudflare SONGS_BUCKET accesses private songs without S3 credentials',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY',
    'R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{SUPABASE_URL:'https://database.test',SUPABASE_ANON_KEY:'test-public',
    SUPABASE_SERVICE_ROLE_KEY:'test-server-secret'});
  for(const keyName of keys.slice(3))delete process.env[keyName];
  const originalFetch=globalThis.fetch;
  const readRanges=[],writes=[],deletes=[];
  const binding={
    async get(objectKey,{range}){
      assert.equal(objectKey,key);readRanges.push(range);
      const buffer=song.subarray(range.offset,range.offset+range.length);
      return {size:song.length,async arrayBuffer(){return buffer}};
    },
    async put(objectKey,bytes,opts){writes.push({objectKey,bytes,opts});},
    async delete(objectKey){deletes.push(objectKey);}
  };
  globalThis.fetch=async(url)=>{
    const target=String(url);
    if(target.endsWith('/auth/v1/user'))return fakeResponse({id:user});
    if(target.includes('/rest/v1/generated_songs'))return fakeResponse([{
      task_id:task,storage_path:'r2:'+key,status:'ready',title:'Private song',voice:'auto'
    }]);
    throw Error('Unexpected network request '+target);
  };
  try{
    const library=await forwardApiRequest(new Request(site+'/api/music/library',{
      headers:{Authorization:'Bearer user-token'}}),handleApi,undefined,{SONGS_BUCKET:binding});
    assert.equal(library.status,200);
    const item=(await library.json()).items[0];
    assert.equal(item.url,null,'No public S3 signed URL is created in Cloudflare');
    assert.match(item.proxyUrl,/^\/api\/music\/audio\//);
    const audio=await forwardApiRequest(new Request(site+item.proxyUrl,{
      headers:{Range:'bytes=4-14'}}),handleApi,undefined,{SONGS_BUCKET:binding});
    assert.equal(audio.status,206);
    assert.equal(audio.headers.get('Content-Range'),`bytes 4-14/${song.length}`);
    assert.deepEqual(Buffer.from(await audio.arrayBuffer()),song.subarray(4,15));
    assert.deepEqual(readRanges,[{offset:4,length:11}]);
    const invalid=await forwardApiRequest(new Request(site+`/api/music/audio/${task}`),handleApi,undefined,{SONGS_BUCKET:binding});
    assert.equal(invalid.status,401);
    assert.equal(readRanges.length,1,'Unverified links never read R2');
    assert.deepEqual(writes,[]);assert.deepEqual(deletes,[]);
  }finally{
    globalThis.fetch=originalFetch;
    for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}
  }
});

test('Cloudflare native R2 archives generated song audio without any S3 key',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY',
    'R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','TREBLO_API_KEY'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{SUPABASE_URL:'https://database.test',SUPABASE_ANON_KEY:'public',
    SUPABASE_SERVICE_ROLE_KEY:'private',TREBLO_API_KEY:'treblo-server-key'});
  for(const name of keys.slice(3,7))delete process.env[name];
  const originalFetch=globalThis.fetch;
  let saved=null;
  const bucket={
    async get(){throw Error('Unexpected read')},
    async put(objectKey,bytes,options){saved={objectKey,bytes,options}},
    async delete(){throw Error('Unexpected delete')}
  };
  globalThis.fetch=async(url,opts={})=>{
    const str=String(url);
    if(str.endsWith('/auth/v1/user'))return fakeResponse({id:user});
    if(str.includes('/rest/v1/admin_users'))return fakeResponse([]);
    if(str.includes('/rest/v1/music_generation_reservations'))return fakeResponse([{id:'reservation'}]);
    if(str.includes('/rest/v1/generated_songs')){
      if(opts.method==='POST')return fakeResponse([{task_id:task}]);
      return fakeResponse([]);
    }
    if(str.includes('/v1/generations/status/'))return fakeResponse({status:'SUCCESS'});
    if(str.includes('/v1/generations/'+task))return fakeResponse({song_paths:['https://songs.example/finished.mp3']});
    if(str==='https://songs.example/finished.mp3')return {
      ok:true,headers:new Headers({'Content-Type':'audio/mpeg','Content-Length':String(song.length)}),
      async arrayBuffer(){return song}
    };
    throw Error('Unexpected network request '+str);
  };
  try{
    const response=await forwardApiRequest(new Request(site+'/api/music/library',{
      method:'POST',headers:{Authorization:'Bearer test-user','Content-Type':'application/json'},
      body:JSON.stringify({taskId:task,title:'New song'})
    }),handleApi,undefined,{SONGS_BUCKET:bucket});
    const output=await response.json();
    assert.equal(response.status,200,JSON.stringify(output));
    assert.equal(output.cloudSaved,true);
    assert.equal(output.url,null,'Worker does not require an S3 signed URL');
    assert.match(output.proxyUrl,/^\/api\/music\/audio\//);
    assert.equal(saved.objectKey,key);
    assert.equal(saved.bytes.byteLength,song.length);
    assert.equal(saved.options.httpMetadata.contentType,'audio/mpeg');
  }finally{
    globalThis.fetch=originalFetch;
    for(const name of keys){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name]}
  }
});
