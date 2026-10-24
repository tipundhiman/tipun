import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMediaStorageRequest } from '../cloudflare/media-storage.js';

const owner = '0b8fde5b-530b-4016-8c39-ac6c9eeed46f';
const mediaId = '3e859cad-871d-45d7-8483-c9ac0e868634';
const songId = 'a2d4cbba-1a1a-4d21-a3ce-299000000001';
const env = bucket => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-public', SUPABASE_SERVICE_ROLE_KEY: 'test-server',
  SONGS_BUCKET: bucket
});
const response = (data, code = 200) => new Response(code === 204 ? null : JSON.stringify(data), { status: code, headers: { 'content-type': 'application/json' } });
const raw = data => new Response(data, { status: 200, headers: { 'content-length': String(data.byteLength) } });

function setup(t) {
  const objects = new Map();
  const database = {
    media: [], songs: [], posts: [], sources: new Map(),
    deleted: []
  };
  const bucket = {
    async put(key, data) {
      const bytes = data instanceof ReadableStream ? new Uint8Array(await new Response(data).arrayBuffer()) : new Uint8Array(data);
      objects.set(key, bytes);return { size: bytes.length };
    },
    async head(key) {const file=objects.get(key);return file ? {size:file.byteLength} : null},
    async get(key, options) {
      const file=objects.get(key);if(!file)return null;
      const offset=options?.range?.offset||0;
      const limit=options?.range?.length||file.byteLength;
      return { size:file.byteLength, body:new Blob([file.slice(offset,offset+limit)]).stream() };
    },
    async delete(key) {objects.delete(key)}
  };
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(String(input));
    const auth = init.headers?.authorization || init.headers?.Authorization;
    if(url.pathname === '/auth/v1/user')return auth === 'Bearer owner' || auth === 'Bearer admin' ? response({id:owner,user_metadata:{name:'Tipun'}}) : response({message:'Invalid token'},401);
    if(url.pathname.startsWith('/storage/v1/object/')) {
      const item=database.sources.get(url.pathname);
      return item ? raw(item) : response({message:'Missing source'},404);
    }
    if(url.pathname === '/rest/v1/admin_users')return response(auth==='Bearer test-server' && database.isAdmin ? [{user_id:owner}] : []);
    if(url.pathname === '/rest/v1/creator_media') {
      if(init.method==='POST'){database.media.push(JSON.parse(init.body));return response(null,201)}
      if(init.method==='PATCH'){
        const candidate=database.media.find(x=>x.id===url.searchParams.get('id')?.slice(3) && x.storage_path===url.searchParams.get('storage_path')?.slice(3));
        if(!candidate)return response([]);
        Object.assign(candidate,JSON.parse(init.body));return response([{id:candidate.id}]);
      }
      if(init.method==='DELETE'){database.media=database.media.filter(x=>x.id!==url.searchParams.get('id')?.slice(3));return response(null,204)}
      const found=url.searchParams.get('id')?database.media.filter(x=>x.id===url.searchParams.get('id').slice(3)):database.media;
      return response(found);
    }
    if(url.pathname === '/rest/v1/generated_songs') {
      if(init.method==='PATCH'){
        const candidate=database.songs.find(x=>x.id===url.searchParams.get('id')?.slice(3) && x.storage_path===url.searchParams.get('storage_path')?.slice(3));
        if(!candidate)return response([]);
        Object.assign(candidate,JSON.parse(init.body));return response([{id:candidate.id}]);
      }
      return response(database.songs);
    }
    if(url.pathname === '/rest/v1/community_posts'){
      if(init.method==='POST')database.posts.push(JSON.parse(init.body));
      if(init.method==='DELETE'){database.deleted.push(url.search);database.posts=[]}
      if(init.method==='PATCH'){
        for(const p of database.posts){
          if(p.media_path === url.searchParams.get('media_path')?.slice(3))Object.assign(p,JSON.parse(init.body));
        }
      }
      return response(null,204);
    }
    throw new Error('Unexpected request: '+url.pathname);
  });
  return { database, objects, bucket, bindings: env(bucket) };
}

function call(path, method = 'GET', headers = {}, body = undefined) {
  return new Request('https://rhymeorbit.in' + path, { method, headers, body });
}

test('non-media API paths fall through to the existing application', async () => {
  assert.equal(await handleMediaStorageRequest(call('/api/health'),{}),null);
});

test('anonymous uploads are rejected before accessing R2', async t => {
  const { bindings, objects } = setup(t);
  const request=call('/api/media/upload','POST',{'content-type':'image/png','x-rhymeorbit-title':'Hi'},new Blob(['picture'],{type:'image/png'}));
  const result=await handleMediaStorageRequest(request,bindings);
  assert.equal(result.status,401);
  assert.equal(objects.size,0);
});

test('authorized uploads store R2, publish and support browser byte ranges', async t => {
  const { bindings, database, objects }=setup(t);
  const content=new Blob(['abcdefghijklmnop'],{type:'image/png'});
  const request=call('/api/media/upload','POST',{
    authorization:'Bearer owner','content-type':'image/png',
    'content-length':String(content.size),'x-rhymeorbit-title':'First%20orbit'
  },content);
  const uploaded=await handleMediaStorageRequest(request,bindings);
  assert.equal(uploaded.status,201);
  assert.equal(database.media.length,1);
  assert.equal(database.posts.length,1);
  assert.equal(database.posts[0].media_bucket,'r2');
  assert.ok(database.media[0].storage_path.startsWith('r2:media/'+owner+'/'));
  assert.equal(objects.size,1);
  const id=database.media[0].id;
  const played=await handleMediaStorageRequest(call('/api/media/file/'+id,'GET',{range:'bytes=3-7'}),bindings);
  assert.equal(played.status,206);
  assert.equal(played.headers.get('content-range'),'bytes 3-7/16');
  assert.equal(await played.text(),'defgh');
  const badRange=await handleMediaStorageRequest(call('/api/media/file/'+id,'GET',{range:'bytes=30-35'}),bindings);
  assert.equal(badRange.status,416);
});

test('media deletion checks owner and removes posts and R2 object',async t=>{
  const { bindings,database,objects }=setup(t);
  const key='media/'+owner+'/'+mediaId+'.jpg';
  database.media.push({id:mediaId,owner,storage_path:'r2:'+key,mime_type:'image/jpeg'});
  database.posts.push({media_path:key,media_bucket:'r2'});
  objects.set(key,new Uint8Array([1,2,3]));
  const payload=JSON.stringify({id:mediaId});
  const unauth=await handleMediaStorageRequest(call('/api/media/delete','POST',{'content-type':'application/json'},payload),bindings);
  assert.equal(unauth.status,401);
  assert.ok(objects.has(key));
  const removed=await handleMediaStorageRequest(call('/api/media/delete','POST',{authorization:'Bearer owner','content-type':'application/json'},payload),bindings);
  assert.equal(removed.status,200);
  assert.equal(database.media.length,0);
  assert.equal(objects.size,0);
});

test('migration is admin-only, copies old files one by one, and retains originals',async t=>{
  const { bindings,database,objects }=setup(t);
  database.isAdmin=true;
  const oldMedia=owner+'/legacy.jpg';
  const oldSong=owner+'/3e859cad-871d-45d7-8483-c9ac0e868634.ogg';
  database.media.push({id:mediaId,owner,storage_path:oldMedia,mime_type:'image/jpeg',size_bytes:4});
  database.songs.push({id:songId,user_id:owner,task_id:mediaId,storage_path:oldSong,status:'ready'});
  database.posts.push({user_id:owner,media_bucket:'creator-media',media_path:oldMedia});
  database.sources.set('/storage/v1/object/creator-media/'+oldMedia,new Uint8Array([1,2,3,4]));
  database.sources.set('/storage/v1/object/authenticated/song-audio/'+oldSong,new Uint8Array([5,6,7,8]));
  const rejected=await handleMediaStorageRequest(call('/api/admin/storage-migration','POST'),bindings);
  assert.equal(rejected.status,401);
  const before=await handleMediaStorageRequest(call('/api/admin/storage-migration','GET',{authorization:'Bearer admin'}),bindings);
  assert.deepEqual((await before.json()).remaining,{media:1,songs:1});
  const first=await handleMediaStorageRequest(call('/api/admin/storage-migration','POST',{authorization:'Bearer admin'}),bindings);
  assert.equal(first.status,200);
  assert.ok(database.media[0].storage_path.startsWith('r2:media/'));
  assert.equal(database.posts[0].media_bucket,'r2');
  const second=await handleMediaStorageRequest(call('/api/admin/storage-migration','POST',{authorization:'Bearer admin'}),bindings);
  assert.equal(second.status,200);
  assert.ok(database.songs[0].storage_path.startsWith('r2:songs/'));
  assert.equal(objects.size,2);
  assert.equal(database.sources.size,2); // originals were never deleted
  const done=await handleMediaStorageRequest(call('/api/admin/storage-migration','POST',{authorization:'Bearer admin'}),bindings);
  assert.equal((await done.json()).complete,true);
});

test('migration verification failure keeps database references unchanged',async t=>{
  const { bindings,database,bucket }=setup(t);
  database.isAdmin=true;
  const oldMedia=owner+'/legacy.jpg';
  database.media.push({id:mediaId,owner,storage_path:oldMedia,mime_type:'image/jpeg',size_bytes:4});
  database.sources.set('/storage/v1/object/creator-media/'+oldMedia,new Uint8Array([1,2,3,4]));
  bucket.head=async()=>({size:3});
  const result=await handleMediaStorageRequest(call('/api/admin/storage-migration','POST',{authorization:'Bearer admin'}),bindings);
  assert.equal(result.status,502);
  assert.equal(database.media[0].storage_path,oldMedia);
  assert.equal(database.sources.size,1);
});
