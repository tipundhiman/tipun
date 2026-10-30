import test from 'node:test';
import assert from 'node:assert/strict';
import { forwardApiRequest } from '../cloudflare/api-adapter.js';

const url = 'https://tipun.dtipun.workers.dev';

test('GET /api/health routes correctly with query string and headers', async () => {
  const result = await forwardApiRequest(new Request(url+'/api/health?probe=1'), async (req,res)=>{
    assert.equal(req.url,'/api/health?probe=1');
    assert.equal(req.method,'GET');
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({ok:true}));
  });
  assert.equal(result.status,200);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.deepEqual(await result.json(),{ok:true});
});

test('POST JSON body remains readable by the Node-style parser', async ()=>{
  const request=new Request(url+'/api/username-login',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:'test_user',password:'not-real'})
  });
  const result=await forwardApiRequest(request,async(req,res)=>{
    let body='';
    for await (const chunk of req) body+=chunk.toString();
    assert.deepEqual(JSON.parse(body),{username:'test_user',password:'not-real'});
    res.writeHead(401,{'Content-Type':'application/json'});
    res.end('{"error":"Invalid username or password"}');
  });
  assert.equal(result.status,401);
});

test('Raw Razorpay webhook is byte exact and not re-serialized',async()=>{
  const bytes=Buffer.from(' {"a" :  1, "b": [1,2]}\n');
  const response=await forwardApiRequest(new Request(url+'/api/billing/test/webhook',{
    method:'POST',body:bytes
  }),async(req,res)=>{
    assert.deepEqual(req.rawBody,bytes);
    const parts=[];for await (const part of req) parts.push(part);
    assert.deepEqual(Buffer.concat(parts),bytes);
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end('{"tracked":true}');
  });
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{tracked:true});
});

test('Oversized webhook bodies rejected before the handler runs',async()=>{
  let called=false;
  const response=await forwardApiRequest(new Request(url+'/api/anything',{
    method:'POST',body:'a'.repeat(131_073)
  }),async()=>{called=true});
  assert.equal(response.status,413);assert.equal(called,false);
});

test('HEAD responses omit body',async()=>{
  const response=await forwardApiRequest(new Request(url+'/api/health',{method:'HEAD'}),async(_,res)=>{
    res.writeHead(200);res.end('not-shown');
  });
  assert.equal(response.status,200);assert.equal(await response.text(),'');
});

test('Cloudflare source IP takes precedence over spoofed forwarded-for',async()=>{
  const request=new Request(url+'/api/health',{
    headers:{'cf-connecting-ip':'203.0.113.6','x-forwarded-for':'1.2.3.4'}
  });
  await forwardApiRequest(request,async(req,res)=>{
    assert.equal(req.headers['x-forwarded-for'],'203.0.113.6');res.end();
  });
});

test('Internal exceptions do not expose secrets or stack traces',async()=>{
  const response=await forwardApiRequest(new Request(url+'/api/health'),async()=>{
    throw new Error('my extremely secret backend value');
  });
  assert.equal(response.status,500);
  assert.doesNotMatch(await response.text(),/extremely secret/);
});

test('Only the existing tipun Worker and R2 bucket are configured',async()=>{
  const {readFileSync}=await import('node:fs');
  const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(cfg.name,'tipun');
  assert.equal(cfg.main,'cloudflare/worker.js');
  assert.equal(cfg.compatibility_date,'2026-10-24');
  assert.deepEqual(cfg.assets.run_worker_first,['/api/*','/.well-known/assetlinks.json']);
  assert.equal(cfg.assets.directory,'./public');
  assert.equal(cfg.r2_buckets[0].binding,'SONGS_BUCKET');
  assert.equal(cfg.r2_buckets[0].bucket_name,'rhymeorbit-songs');
});
