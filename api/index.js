
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { r2Enabled, r2ConfigState, r2Put, r2PresignedGet, r2Remove, validR2Key } from './r2.js';
import {handleTestBilling,handleTestWebhook} from './razorpay-test.js';

const env = k => process.env[k] || '';
const limits = new Map();
const send = (res, code, value) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(value));
};
async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 25000) throw new Error('Request too large');
  }
  try { return JSON.parse(data || '{}'); }
  catch { throw new Error('Invalid JSON'); }
}
function rate(req, res) {
  const key = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
  const now = Date.now();
  const value = limits.get(key) || { n: 0, t: now };
  if (now - value.t > 60000) { value.n = 0; value.t = now; }
  value.n++;
  limits.set(key, value);
  if (value.n > 25) {
    send(res, 429, { error: 'Too many requests. Try again later.' });
    return false;
  }
  return true;
}
const config = () => ({
  url: env('SUPABASE_URL').replace(/\/$/, ''),
  anon: env('SUPABASE_ANON_KEY'),
  service: env('SUPABASE_SERVICE_ROLE_KEY')
});
async function userFromToken(token) {
  const { url, anon } = config();
  if (!url || !anon || !token) return null;
  const response = await fetch(url + '/auth/v1/user', {
    headers: { apikey: anon, Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(9000)
  });
  return response.ok ? await response.json() : null;
}
async function supaFetch(endpoint, opts = {}) {
  const c = config();
  if (!c.url || !c.service) return { ok: false, status: 503, data: { error: 'Database service is not configured' } };
  const response = await fetch(c.url + endpoint, {
    ...opts,
    headers: {
      apikey: c.service,
      Authorization: 'Bearer ' + c.service,
      'Content-Type': 'application/json',
      ...opts.headers
    },
    signal: AbortSignal.timeout(10000)
  });
  const txt = await response.text();
  let data;
  try { data = JSON.parse(txt); }
  catch { data = txt ? { error: txt.slice(0, 200) } : null; }
  return { ok: response.ok, status: response.status, data };
}


/** Safe readiness checks: never return secrets or provider credentials. */
const hasR2Bucket=bucket=>Boolean(bucket&&typeof bucket.get==='function'&&typeof bucket.put==='function'&&typeof bucket.delete==='function');
const r2Ready=bucket=>hasR2Bucket(bucket)||r2Enabled();
async function musicReadiness(bucket) {
  const providerReady=Boolean(env('TREBLO_API_KEY'));
  const publicAllowed=env('PUBLIC_MUSIC_GENERATION_ENABLED')!=='false';
  const databaseConfigured=Boolean(config().url&&config().service);
  let quotaTableReady=false,reservationTableReady=false,libraryReady=false,audioStorageReady=false;
  if(databaseConfigured){
    const paths=[
      '/rest/v1/music_usage?select=user_id&limit=0',
      '/rest/v1/music_generation_reservations?select=id&limit=0',
      '/rest/v1/generated_songs?select=task_id&limit=0',
      '/storage/v1/bucket/song-audio'
    ];
    const check=await Promise.all(paths.map(path=>supaFetch(path).catch(()=>({ok:false}))));
    [quotaTableReady,reservationTableReady,libraryReady,audioStorageReady]=check.map(r=>r.ok);
  }
  audioStorageReady=audioStorageReady||r2Ready(bucket);
  return {
    providerReady,publicAllowed,databaseConfigured,quotaTableReady,
    reservationTableReady,libraryReady,audioStorageReady,
    ready:providerReady&&publicAllowed&&databaseConfigured&&quotaTableReady&&reservationTableReady&&libraryReady&&audioStorageReady
  };
}

async function cloudSongs(userId) {
  return supaFetch('/rest/v1/generated_songs?user_id=eq.'+encodeURIComponent(userId)+'&select=task_id,title,voice,status,storage_path,created_at&order=created_at.desc&limit=100');
}
async function signedAudio(path,bucket) {
  if(!path)return null;
  if(path.startsWith('r2:')){
    if(hasR2Bucket(bucket))return null; // Native private playback is used in Workers.
    if(!r2Enabled())return null;
    try{return r2PresignedGet(path.slice(3))}catch{return null}
  }
  const c=config();
  const response=await fetch(c.url+'/storage/v1/object/sign/song-audio/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'POST',headers:{apikey:c.service,Authorization:'Bearer '+c.service,'Content-Type':'application/json'},
    body:JSON.stringify({expiresIn:3600}),signal:AbortSignal.timeout(8000)
  });
  const data=await response.json().catch(()=>({}));
  return response.ok&&data.signedURL?c.url+'/storage/v1'+data.signedURL:null;
}
// A short-lived, scoped capability lets native <audio> request private R2 byte
// ranges without exposing Supabase credentials or making the bucket public.
const AUDIO_CHUNK_BYTES=1024*1024;
const AUDIO_TOKEN_SECONDS=3600;
const audioTokenKey=()=>env('SUPABASE_SERVICE_ROLE_KEY');
function createAudioToken(userId,taskId,now=Math.floor(Date.now()/1000)) {
  const expires=now+AUDIO_TOKEN_SECONDS;
  const mac=createHmac('sha256',audioTokenKey()).update('ro-audio-v1:'+userId+':'+taskId+':'+expires).digest('hex');
  return userId+'.'+expires+'.'+mac;
}
function verifyAudioToken(taskId,value,now=Math.floor(Date.now()/1000)) {
  const match=/^([0-9a-f-]{36})\.(\d{10})\.([0-9a-f]{64})$/i.exec(String(value||''));
  if(!match||!audioTokenKey())return null;
  const [,userId,rawExpires,signature]=match;
  const expires=Number(rawExpires);
  if(expires<=now||expires>now+AUDIO_TOKEN_SECONDS||!/^[a-zA-Z0-9_-]{1,100}$/.test(taskId))return null;
  const expected=createHmac('sha256',audioTokenKey()).update('ro-audio-v1:'+userId+':'+taskId+':'+expires).digest();
  return timingSafeEqual(expected,Buffer.from(signature,'hex'))?userId:null;
}
function privateAudioUrl(userId,taskId,storagePath,bucket) {
  if(!storagePath?.startsWith('r2:')||!r2Ready(bucket)||!/^[a-zA-Z0-9_-]{1,100}$/.test(taskId))return null;
  return '/api/music/audio/'+encodeURIComponent(taskId)+'?token='+encodeURIComponent(createAudioToken(userId,taskId));
}
async function servePrivateAudio(req,res,taskId,token) {
  const userId=verifyAudioToken(taskId,token);
  if(!userId)return send(res,401,{error:'Audio access link expired. Refresh your song library.'});
  const found=await supaFetch('/rest/v1/generated_songs?user_id=eq.'+encodeURIComponent(userId)+'&task_id=eq.'+encodeURIComponent(taskId)+'&select=storage_path&limit=1');
  if(!found.ok)return send(res,503,{error:'Private song library unavailable'});
  const storagePath=found.data?.[0]?.storage_path;
  if(!storagePath?.startsWith('r2:')||!r2Ready(req.r2Bucket))return send(res,404,{error:'Archived audio not found'});
  const key=storagePath.slice(3);
  if(!validR2Key(key))return send(res,404,{error:'Archived audio not found'});
  const header=String(req.headers.range||'');
  const match=header? /^bytes=(\d+)-(\d*)$/.exec(header):null;
  if(header&&!match)return send(res,416,{error:'Unsupported audio range'});
  const start=match?Number(match[1]):0;
  const requestedEnd=match&&match[2]?Number(match[2]):start+AUDIO_CHUNK_BYTES-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(requestedEnd)||start<0||start>=20_000_000||requestedEnd<start)
    return send(res,416,{error:'Invalid audio range'});
  const end=Math.min(requestedEnd,start+AUDIO_CHUNK_BYTES-1);
  if(hasR2Bucket(req.r2Bucket)){
    // Cloudflare's existing R2 binding avoids exposing or provisioning S3 keys.
    const object=await req.r2Bucket.get(key,{range:{offset:start,length:end-start+1}});
    if(!object)return send(res,404,{error:'Archived audio not found'});
    const total=Number(object.size);
    if(!Number.isSafeInteger(total)||total<=0||total>20_000_000)return send(res,502,{error:'Invalid archived audio size'});
    if(start>=total)return send(res,416,{error:'Audio range outside file'});
    const actualEnd=Math.min(end,total-1);
    const bytes=Buffer.from(await object.arrayBuffer());
    if(bytes.length!==actualEnd-start+1||bytes.length>AUDIO_CHUNK_BYTES)
      return send(res,502,{error:'Incomplete private audio response'});
    const mime=key.endsWith('.ogg')?'audio/ogg':'audio/mpeg';
    res.writeHead(206,{
      'Content-Type':mime,'Content-Length':String(bytes.length),
      'Content-Range':'bytes '+start+'-'+actualEnd+'/'+total,
      'Accept-Ranges':'bytes','Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff'
    });
    return res.end(bytes);
  }
  const upstream=await fetch(r2PresignedGet(storagePath.slice(3)),{
    headers:{Range:'bytes='+start+'-'+end},signal:AbortSignal.timeout(16000)
  });
  if(upstream.status===416)return send(res,416,{error:'Audio range outside file'});
  if(upstream.status!==206)return send(res,502,{error:'Private audio storage did not return a byte range'});
  const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(upstream.headers.get('content-range')||'');
  const mime=(upstream.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!range||!['audio/ogg','audio/mpeg','audio/mp3'].includes(mime))return send(res,502,{error:'Invalid archived audio response'});
  const [,actualStart,actualEnd,total]=range.map(Number);
  const bytes=Buffer.from(await upstream.arrayBuffer());
  if(actualStart!==start||actualEnd<actualStart||Number(total)>20_000_000||bytes.length!==actualEnd-actualStart+1||bytes.length>AUDIO_CHUNK_BYTES)
    return send(res,502,{error:'Incomplete private audio response'});
  res.writeHead(206,{
    'Content-Type':mime,'Content-Length':String(bytes.length),
    'Content-Range':'bytes '+actualStart+'-'+actualEnd+'/'+total,
    'Accept-Ranges':'bytes','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff'
  });
  res.end(bytes);
}
async function trebleAudio(id) {
  const headers={Authorization:'Bearer '+env('TREBLO_API_KEY')};
  const status=await fetch('https://api.treblo.com/v1/generations/status/'+encodeURIComponent(id),{headers,signal:AbortSignal.timeout(10000)});
  if(!status.ok)throw Error('Treblo status lookup failed');
  const st=await status.json();
  const raw = typeof st === 'string' ? st : (st.status || st.state || '');
  if(raw !== 'SUCCESS')return null;
  const result=await fetch('https://api.treblo.com/v1/generations/'+encodeURIComponent(id),{headers,signal:AbortSignal.timeout(10000)});
  if(!result.ok)throw Error('Treblo song lookup failed');
  const song=await result.json();
  return (song.song_paths||[]).find(url=>typeof url==='string'&&url.startsWith('https://'))||null;
}
async function archiveAudio(userId,id,url,bucket) {
  const c=config();
  const download=await fetch(url,{signal:AbortSignal.timeout(16000)});
  if(!download.ok)throw Error('Treblo audio download failed');
  const mime=(download.headers.get('content-type')||'').toLowerCase();
  if(!mime.includes('audio/')&&!mime.includes('octet-stream'))throw Error('Provider returned non-audio data');
  if(Number(download.headers.get('content-length')||0)>20_000_000)throw Error('Audio exceeds 20 MB storage limit');
  const isOgg=mime.includes('ogg')||/\.ogg(?:\?|$)/i.test(url);
  const path=userId+'/'+id+(isOgg?'.ogg':'.mp3');
  const bytes=await download.arrayBuffer();
  if(bytes.byteLength>20_000_000||bytes.byteLength<1000)throw Error('Invalid audio size');
  if(r2Ready(bucket)){
    const key='songs/'+userId+'/'+id+(isOgg?'.ogg':'.mp3');
    if(hasR2Bucket(bucket))await bucket.put(key,bytes,{httpMetadata:{contentType:isOgg?'audio/ogg':'audio/mpeg'}});
    else await r2Put(key,bytes,isOgg?'audio/ogg':'audio/mpeg');
    return 'r2:'+key;
  }
  if(r2ConfigState()!=='not-configured')throw new Error('R2 storage configuration incomplete');
  const upload=await fetch(c.url+'/storage/v1/object/song-audio/'+path,{
    method:'POST',headers:{apikey:c.service,Authorization:'Bearer '+c.service,'Content-Type':isOgg?'audio/ogg':'audio/mpeg','x-upsert':'true'},
    body:bytes,signal:AbortSignal.timeout(16000)
  });
  if(!upload.ok)throw Error('Cloud audio upload failed');
  return path;
}

const rpc = (name, params) => supaFetch('/rest/v1/rpc/' + name, {
  method: 'POST',
  body: JSON.stringify(params)
});
const bearer = req => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
async function auth(req, res) {
  const user = await userFromToken(bearer(req));
  if (!user?.id) { send(res, 401, { error: 'Sign in required or Supabase authentication unavailable' }); return null; }
  return user;
}
async function isAdmin(userId) {
  const result = await supaFetch('/rest/v1/admin_users?user_id=eq.' + encodeURIComponent(userId) + '&select=user_id&limit=1');
  if (!result.ok) throw new Error('Admin authorization unavailable');
  return Array.isArray(result.data) && result.data.length === 1;
}
async function aiGenerate(kind, input) {
  const key = env('GEMINI_API_KEY');
  if (!key) return { error: 'Writing assistant temporarily unavailable.' };
  const prompts = {
    lyrics: 'You are a creative songwriting collaborator. Write original song lyrics based on the user brief. Avoid copying existing songs. Respond in the requested language. Output clear sections.',
    doctor: 'Analyze the supplied lyrics. Give specific, constructive notes on rhyme, meter, hooks, originality and structure. Preserve original lyrics; do not rewrite unless asked.',
    vibe: 'Create an actionable original song concept: theme, story arc, genre, tempo suggestion, instruments, hook idea and structure. Do not claim to create audio.',
    help: 'You are Riya, the friendly multilingual AI creative guide for RhymeOrbit. Reply in the language and script the user uses (including Hindi, Hinglish, English and other languages). Answer general questions helpfully, and website questions with clear steps. RhymeOrbit combines AI songwriting and shayari, an AI music generation integration that may not yet be publicly enabled, My Studio, creator profiles, Community, Vibe Match, and creator tools. Explain genuine strengths of this combined creator-focused experience when relevant. Be enthusiastic but factual: never claim RhymeOrbit is objectively better than every other AI, never invent features, uptime, pricing, availability, commercial rights, payment support, or completed actions. When comparing with other AI tools, acknowledge their strengths and explain which RhymeOrbit features are distinct or planned. Creator Kit is a beta downloadable artist press kit builder with three visual themes; its files are not automatically published or stored in the cloud. If a question needs live external data you cannot verify, say so. Do not request passwords or private account details. Be concise unless asked for detail.',
    shayari: 'Write original expressive shayari or poetry based on the user prompt. Respect requested Hindi, Urdu, Punjabi or English language and mood. Avoid copyrighted imitation.'
  };
  if (!prompts[kind]) return { error: 'Invalid AI mode' };
  const model = env('GEMINI_MODEL') || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompts[kind] }] },
      contents: [{ parts: [{ text: input.slice(0, 12000) }] }],
      generationConfig: { maxOutputTokens: 1100, temperature: .75 }
    }),
    signal: AbortSignal.timeout(30000)
  });
  const result = await response.json();
  if (!response.ok) return { error: 'Writing assistant temporarily unavailable. Please try again later.' };
  return { text: result.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || 'No text returned' };
}
function pathOf(req) {
  const original = req.headers['x-vercel-original-url'];
  const raw = original || req.url || '/';
  let path = new URL(raw, 'http://localhost').pathname;
  if (path === '/api/index.js' || path === '/index.js') path = '/api/health';
  return { path, raw: new URL(raw, 'http://localhost') };
}
export async function handleApi(req, res) {
  const { path, raw } = pathOf(req);
  try {
    if(req.method==='GET'&&path.startsWith('/api/music/audio/')){
      const taskId=decodeURIComponent(path.slice('/api/music/audio/'.length));
      return servePrivateAudio(req,res,taskId,raw.searchParams.get('token'));
    }
    if(path==='/api/billing/test/webhook')return handleTestWebhook(req,res);
    if(path.startsWith('/api/billing/test/')){
      const handled=await handleTestBilling(req,res,{path,send,auth,isAdmin,supaFetch,body,rate});
      if(handled)return;
    }
    if (req.method === 'GET' && path === '/api/storage/status') {
      const user=await auth(req,res);if(!user)return;
      if(!await isAdmin(user.id))return send(res,403,{error:'Admin only'});
      return send(res,200,{storageConfigured:r2Ready(req.r2Bucket),state:hasR2Bucket(req.r2Bucket)?'bound':r2ConfigState(),bucket:r2Ready(req.r2Bucket)?'rhymeorbit-songs':null,note:'A song upload is required to verify real R2 write access.'});
    }
    if (req.method === 'GET' && path === '/api/health') {
      return send(res, 200, {
        ok: true,
        authConfigured: !!(env('SUPABASE_URL') && env('SUPABASE_ANON_KEY')),
        aiConfigured: !!env('GEMINI_API_KEY')
      });
    }
    if (req.method === 'GET' && path === '/api/youtube') {
      if (!rate(req, res)) return;
      const key = env('YOUTUBE_API_KEY');
      if (!key) return send(res, 503, { error: 'YouTube API is not configured' });
      const q = raw.searchParams.get('q')?.trim() || '';
      if (q.length < 2 || q.length > 100) return send(res, 400, { error: 'Search must be 2–100 characters' });
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      for (const [k, v] of Object.entries({ part: 'snippet', type: 'video', videoEmbeddable: 'true', safeSearch: 'moderate', maxResults: '9', q, key })) url.searchParams.set(k, v);
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const data = await response.json();
      if (!response.ok) return send(res, 502, { error: 'YouTube search unavailable or quota exceeded' });
      const items = (data.items || [])
        .filter(x => /^[a-zA-Z0-9_-]{11}$/.test(x.id?.videoId || ''))
        .map(x => ({ id: x.id.videoId, title: x.snippet?.title || '', channel: x.snippet?.channelTitle || '', thumbnail: x.snippet?.thumbnails?.medium?.url || '' }));
      return send(res, 200, { items });
    }
    if (req.method === 'GET' && path === '/api/config') {
      return send(res, 200, {
        supabaseUrl: env('SUPABASE_URL') || null,
        supabaseAnonKey: env('SUPABASE_ANON_KEY') || null,
        usernameLogin: !!env('SUPABASE_SERVICE_ROLE_KEY')
      });
    }
    if (req.method === 'GET' && path === '/api/music/status') {
      const checks=await musicReadiness(req.r2Bucket);
      return send(res,200,{
        publicGenerationEnabled:checks.ready,
        supportsVocals:checks.ready,
        freeMonthlySongs:3,checkoutEnabled:false,
        message:checks.ready?
          'Song generation is available. Sign in to create.':
          'Song generation is temporarily unavailable. Please try again later.'
      });
    }
    if (req.method === 'GET' && path === '/api/music/credits') {
      if (!rate(req, res)) return;
      const user = await auth(req, res);
      if (!user) return;
      const month = new Date().toISOString().slice(0, 7) + '-01';
      const [subscription, usage] = await Promise.all([
        supaFetch('/rest/v1/subscriptions?user_id=eq.' + encodeURIComponent(user.id) + '&select=plan,status,monthly_song_limit,expires_at&limit=1'),
        supaFetch('/rest/v1/music_usage?user_id=eq.' + encodeURIComponent(user.id) + '&month_start=eq.' + month + '&select=songs_used,songs_reserved&limit=1')
      ]);
      if (!subscription.ok || !usage.ok) return send(res, 503, { error: 'Music credits are temporarily unavailable' });
      const s = subscription.data?.[0];
      const u = usage.data?.[0];
      const active = !s || (s.status === 'active' && (!s.expires_at || Date.parse(s.expires_at) > Date.now()));
      const limit = !active ? 0 : 3;
      const used = u?.songs_used || 0;
      const reserved = u?.songs_reserved || 0;
      return send(res, 200, { plan: s?.plan || 'free', monthlyLimit: limit, used, reserved, remaining: Math.max(0, limit - used - reserved), monthStart: month });
    }

    if (req.method === 'GET' && path === '/api/music/library') {
      const user=await auth(req,res);if(!user)return;
      const found=await cloudSongs(user.id);
      if(!found.ok)return send(res,503,{error:'Cloud song library not set up. Run the Supabase migration SQL first.'});
      const items=await Promise.all(found.data.map(async row=>({
        id:row.task_id,title:row.title,voice:row.voice,status:row.status,createdAt:row.created_at,
        url:await signedAudio(row.storage_path,req.r2Bucket),proxyUrl:privateAudioUrl(user.id,row.task_id,row.storage_path,req.r2Bucket),cloudSaved:!!row.storage_path
      })));
      return send(res,200,{items});
    }
    if (req.method === 'POST' && path === '/api/music/library') {
      if (!rate(req, res)) return;
      const data = await body(req);
      const user=await auth(req,res);if(!user)return;
      const admin=await isAdmin(user.id);
      if(!admin){
        const requestedId=String(data.taskId||'').trim();
        if(!/^[a-zA-Z0-9_-]{1,100}$/.test(requestedId))return send(res,400,{error:'Invalid task ID'});
        const own=await supaFetch('/rest/v1/music_generation_reservations?user_id=eq.'+encodeURIComponent(user.id)+'&task_id=eq.'+encodeURIComponent(requestedId)+'&select=id&limit=1');
        if(!own.ok)return send(res,503,{error:'Song ownership verification unavailable'});
        if(!own.data?.length)return send(res,404,{error:'Song not found in your account'});
      }
      const id=String(data.taskId||'').trim();
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return send(res,400,{error:'Invalid Treblo task ID'});
      const existing=await supaFetch('/rest/v1/generated_songs?user_id=eq.'+encodeURIComponent(user.id)+'&task_id=eq.'+encodeURIComponent(id)+'&select=storage_path&limit=1');
      if(!existing.ok)return send(res,503,{error:'Cloud library table missing. Run the SQL migration.'});
      let storagePath=existing.data?.[0]?.storage_path||null;
      let warning=null;
      if(!storagePath){
        try{const url=await trebleAudio(id);if(url)storagePath=await archiveAudio(user.id,id,url,req.r2Bucket);else warning='Treblo song still processing; try recovery again when ready.'}
        catch(e){warning=e.message||'Audio archival failed'}
      }
      const title=String(data.title||'My AI Song').trim().slice(0,100)||'My AI Song';
      const voice=['male','female','duet','auto'].includes(data.voice)?data.voice:'auto';
      const save=await supaFetch('/rest/v1/generated_songs?on_conflict=user_id,task_id',{
        method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
        body:JSON.stringify({user_id:user.id,task_id:id,title,voice,status:storagePath?'ready':'pending',storage_path:storagePath})
      });
      if(!save.ok)return send(res,503,{error:'Unable to save cloud song record',detail:save.data?.message});
      return send(res,200,{id,cloudSaved:!!storagePath,warning,url:await signedAudio(storagePath,req.r2Bucket),proxyUrl:privateAudioUrl(user.id,id,storagePath,req.r2Bucket)});
    }
    if (req.method === 'DELETE' && path === '/api/music/library') {
      if (!rate(req, res)) return;
      const data = await body(req);
      const user=await auth(req,res);if(!user)return;
      const id=String(data.taskId||'').trim();
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return send(res,400,{error:'Invalid song task ID'});
      const found=await supaFetch('/rest/v1/generated_songs?user_id=eq.'+encodeURIComponent(user.id)+'&task_id=eq.'+encodeURIComponent(id)+'&select=storage_path&limit=1');
      if(!found.ok)return send(res,503,{error:'Cloud song library unavailable'});
      if(!found.data?.length)return send(res,404,{error:'Song is not stored in your cloud library'});
      const storagePath=found.data[0].storage_path;
      if(storagePath){
        if(storagePath.startsWith('r2:')){
          try{if(hasR2Bucket(req.r2Bucket))await req.r2Bucket.delete(storagePath.slice(3));else await r2Remove(storagePath.slice(3))}
          catch{return send(res,502,{error:'Audio deletion unavailable. Song record was kept.'})}
        }else{
        const c=config();
        const removed=await fetch(c.url+'/storage/v1/object/song-audio/'+storagePath.split('/').map(encodeURIComponent).join('/'),{
          method:'DELETE',headers:{apikey:c.service,Authorization:'Bearer '+c.service},
          signal:AbortSignal.timeout(12000)
        }).catch(()=>null);
        if(!removed?.ok)return send(res,502,{error:'Audio could not be deleted from cloud storage. Song record was kept.'});
        }
      }
      const deleted=await supaFetch('/rest/v1/generated_songs?user_id=eq.'+encodeURIComponent(user.id)+'&task_id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
      if(!deleted.ok)return send(res,503,{error:'Audio removed, but database record deletion failed. Retry deletion.'});
      return send(res,200,{deleted:true,id,archivedAudioDeleted:!!storagePath});
    }
    if (req.method === 'GET' && path === '/api/music/history') {
      if (!rate(req, res)) return;
      const user = await auth(req, res);
      if (!user) return;
      const result = await supaFetch('/rest/v1/music_generations?user_id=eq.' + encodeURIComponent(user.id) + '&select=id,status,credit_status,created_at,completed_at,output_url&order=created_at.desc&limit=30');
      return result.ok ? send(res, 200, { items: result.data }) : send(res, 503, { error: 'Music history unavailable' });
    }
    if (req.method === 'GET' && path === '/api/admin/music-readiness') {
      if(!rate(req,res))return;
      const user=await auth(req,res);if(!user)return;
      if(!await isAdmin(user.id))return send(res,403,{error:'Admin access required'});
      const checks=await musicReadiness(req.r2Bucket);
      const blockers=[];
      if(!checks.providerReady)blockers.push('Music provider credential not configured in production');
      if(!checks.publicAllowed)blockers.push('Public song-generation switch is disabled');
      if(!checks.databaseConfigured)blockers.push('Supabase service-role database connection unavailable');
      if(!checks.quotaTableReady)blockers.push('music_usage table missing or inaccessible');
      if(!checks.reservationTableReady)blockers.push('music_generation_reservations table missing or inaccessible');
      if(!checks.libraryReady)blockers.push('generated_songs table missing or inaccessible');
      if(!checks.audioStorageReady)blockers.push('Private song-audio storage bucket missing or inaccessible');
      const month=new Date().toISOString().slice(0,7)+'-01';
      const recent=checks.reservationTableReady?
        await supaFetch('/rest/v1/music_generation_reservations?month_start=eq.'+month+'&select=id,status,created_at&order=created_at.desc&limit=100'):null;
      const items=recent?.ok&&Array.isArray(recent.data)?recent.data:[];
      const counts={
        recordsShown:items.length,
        submitted:items.filter(x=>x.status==='submitted'||x.status==='completed').length,
        refunded:items.filter(x=>x.status==='refunded').length,
        reserved:items.filter(x=>x.status==='reserved').length
      };
      const estimate=Number(env('MUSIC_ESTIMATED_COST_PER_SONG_USD'));
      const validEstimate=env('MUSIC_ESTIMATED_COST_PER_SONG_USD')!==''&&Number.isFinite(estimate)&&estimate>=0;
      return send(res,200,{
        isAdmin:true,ready:checks.ready,
        checks:{...checks,r2StorageState:hasR2Bucket(req.r2Bucket)?'bound':r2ConfigState(),r2StorageConfigured:r2Ready(req.r2Bucket)},blockers,month,counts,
        estimatedCostUsd:validEstimate?Number((counts.submitted*estimate).toFixed(2)):null,
        estimateDisclaimer:'Optional manual estimate based on up to 100 returned tasks; not actual provider billing. Configure MUSIC_ESTIMATED_COST_PER_SONG_USD to enable.'
      });
    }
    if (req.method === 'GET' && path === '/api/admin/overview') {
      if (!rate(req, res)) return;
      const user = await auth(req, res);
      if (!user) return;
      if (!await isAdmin(user.id)) return send(res, 403, { error: 'Admin access required' });
      const month = new Date().toISOString().slice(0, 7) + '-01';
      const [admins, subs, usage, gens] = await Promise.all([
        supaFetch('/rest/v1/admin_users?select=user_id'),
        supaFetch('/rest/v1/subscriptions?select=user_id,plan,status,monthly_song_limit,expires_at,updated_at&order=updated_at.desc&limit=100'),
        supaFetch('/rest/v1/music_usage?month_start=eq.' + month + '&select=user_id,songs_used,songs_reserved&limit=100'),
        supaFetch('/rest/v1/music_generations?select=id,user_id,status,credit_status,created_at&order=created_at.desc&limit=100')
      ]);
      if (![admins, subs, usage, gens].every(x => x.ok)) return send(res, 503, { error: 'Admin dashboard data unavailable' });
      return send(res, 200, {
        isAdmin: true,
        monthStart: month,
        adminCount: admins.data.length,
        subscriptions: subs.data,
        monthlyUsage: usage.data,
        recentGenerations: gens.data,
        note: 'Lists show at most 100 rows; totals are not global user counts.'
      });
    }
    if (req.method === 'GET' && path.startsWith('/api/music/prediction/')) {
      if (!rate(req, res)) return;
      const user = await auth(req, res);
      if (!user) return;
      const admin=await isAdmin(user.id);
      const id = decodeURIComponent(path.slice('/api/music/prediction/'.length));
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return send(res, 400, { error: 'Invalid task ID' });
      if(!admin){
        const own=await supaFetch('/rest/v1/music_generation_reservations?user_id=eq.'+encodeURIComponent(user.id)+'&task_id=eq.'+encodeURIComponent(id)+'&select=id&limit=1');
        if(!own.ok)return send(res,503,{error:'Song ownership verification unavailable'});
        if(!own.data?.length)return send(res,404,{error:'Song not found in your account'});
      }
      if (!env('TREBLO_API_KEY')) return send(res, 503, { error: 'Music service unavailable' });
      const headers = { Authorization: 'Bearer ' + env('TREBLO_API_KEY') };
      const response = await fetch('https://api.treblo.com/v1/generations/status/' + encodeURIComponent(id), {
        headers, signal: AbortSignal.timeout(12000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return send(res, 502, { error: 'Song status temporarily unavailable' });
      const raw = typeof result === 'string' ? result : (result.status || result.state || '');
      if (raw === 'FAILURE') {
        if(!admin)await rpc('ro_refund_failed_song',{p_user:user.id,p_task:id});
        await supaFetch('/rest/v1/generated_songs?user_id=eq.'+encodeURIComponent(user.id)+'&task_id=eq.'+encodeURIComponent(id),{
          method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'failed'})
        });
        return send(res,200,{id,status:'failed',error:'Generation failed. A charged song credit is restored after confirmed failure.'});
      }
      if (raw !== 'SUCCESS') return send(res, 200, { id, status: 'processing' });
      const finished = await fetch('https://api.treblo.com/v1/generations/' + encodeURIComponent(id), {
        headers, signal: AbortSignal.timeout(12000)
      });
      const song = await finished.json().catch(() => ({}));
      if (!finished.ok) return send(res, 502, { error: 'Song audio is temporarily unavailable' });
      const output = (song.song_paths || []).find(x => typeof x === 'string' && /^https:\/\//.test(x));
      return send(res, 200, { id, status: output ? 'succeeded' : 'failed', output: output || null, error: output ? null : 'No audio URL returned' });
    }
    if (req.method !== 'POST') return send(res, 404, { error: 'Not found' });
    if (!rate(req, res)) return;
    const data = await body(req);
    if (path === '/api/username-login') {
      const { url, anon, service } = config();
      if (!url || !anon || !service) return send(res, 503, { error: 'Authentication not configured' });
      const username = String(data.username || '').trim().toLowerCase();
      const password = String(data.password || '');
      if (!/^[a-z0-9_]{3,24}$/.test(username) || password.length < 8) return send(res, 400, { error: 'Invalid username or password' });
      const lookup = await supaFetch('/rest/v1/profiles?username=eq.' + encodeURIComponent(username) + '&select=email&limit=1');
      if (!lookup.ok || !lookup.data?.[0]?.email) return send(res, 401, { error: 'Invalid username or password' });
      const response = await fetch(url + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: anon, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lookup.data[0].email, password }),
        signal: AbortSignal.timeout(10000)
      });
      const result = await response.json();
      if (!response.ok) return send(res, 401, { error: 'Invalid username or password' });
      return send(res, 200, { access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in, user: result.user });
    }
    if (path === '/api/music/generate') {
      const user = await auth(req, res);
      if (!user) return;
      const admin = await isAdmin(user.id);
      const publicEnabled = env('PUBLIC_MUSIC_GENERATION_ENABLED') !== 'false';
      if (!admin && !publicEnabled) return send(res, 503, { error: 'Song generation temporarily unavailable' });
      if (!env('TREBLO_API_KEY')) return send(res, 503, { error: 'Song generation temporarily unavailable' });
      if(!admin&&data.rightsConfirmed!==true)return send(res,400,{error:'Confirm you own or are authorized to use your lyrics and references before creating a song.'});
      const ideaOrLyrics=String(data.lyrics||'').trim();
      const voice=['male','female','duet','auto'].includes(data.voice)?data.voice:'auto';
      const style=String(data.prompt||'').trim();
      const genre=String(data.genre||'Pop').trim().slice(0,60);
      const mood=String(data.mood||'Creative').trim().slice(0,60);
      const language=String(data.language||'Hindi').trim().slice(0,60);
      if(ideaOrLyrics.length<5||ideaOrLyrics.length>5000||style.length>1024)
        return send(res,400,{error:'Enter your idea or lyrics (5–5000 characters); music style is optional.'});
      const hasSections=/\[(verse|chorus|hook|bridge|intro|outro|मुखड़ा|अंतरा)/i.test(ideaOrLyrics);
      const hasLines=ideaOrLyrics.split(/\r?\n/).filter(Boolean).length>=3;
      const isFullLyrics=hasSections||hasLines||ideaOrLyrics.length>=260;
      const vocal=voice==='duet'?'male and female duet, alternating singers':voice==='auto'?'natural lead vocals':voice+' lead vocals';
      const instructions=[style||(genre+' music, '+mood+' mood'),'Language: '+language,'Vocals: '+vocal,
        isFullLyrics?'Compose a complete song with the supplied lyrics.':
        'Write complete original lyrics and compose a vocal song from this idea: '+ideaOrLyrics].join('. ').slice(0,1450);
      let reservationId = null;
      if(!admin){
        const backing=await supaFetch('/rest/v1/generated_songs?select=task_id&limit=0');
        if(!backing.ok)return send(res,503,{error:'Song library is unavailable. Please try again later.'});
      }
      if (!admin) {
        const reserved = await rpc('ro_reserve_song', { p_user: user.id });
        if (!reserved.ok || typeof reserved.data !== 'string') {
          const msg = JSON.stringify(reserved.data || {});
          return send(res, /quota exhausted|subscription inactive/i.test(msg) ? 403 : 503, {
            error: /quota exhausted/i.test(msg) ? 'You have used your 3 free songs this month. Your limit resets next calendar month.' : 'Song balance unavailable. Please try again later.'
          });
        }
        reservationId = reserved.data;
      }
      let response;
      try {
        response = await fetch('https://api.treblo.com/v1/generations/v3', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env('TREBLO_API_KEY'), 'Content-Type': 'application/json' },
        // Keep a high-bitrate source for optional lower-bitrate user downloads.
        body: JSON.stringify({prompt:instructions,...(isFullLyrics?{lyrics:ideaOrLyrics}:{}),instrumental:false,output_format:'mp3',output_bit_rate:320}),
        signal: AbortSignal.timeout(25000)
      });
      } catch (error) {
        if (reservationId) await rpc('ro_finish_song', { p_user: user.id, p_reservation: reservationId, p_task: null, p_success: false });
        throw error;
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.task_id) {
        if (reservationId) await rpc('ro_finish_song', { p_user: user.id, p_reservation: reservationId, p_task: null, p_success: false });
        return send(res, response.status === 429 ? 429 : 502, { error: 'Song generation could not start. Your monthly credit was not used.' });
      }
      if (reservationId) {
        const finalized = await rpc('ro_finish_song', { p_user: user.id, p_reservation: reservationId, p_task: String(result.task_id), p_success: true });
        if (!finalized.ok || finalized.data !== true) return send(res, 503, { error: 'Song submitted but usage confirmation failed. Contact support with task ID: ' + String(result.task_id) });
      }
      // Register the task immediately. A user can resume it from another device.
      // A backup failure never erases the task ID or creates another paid generation.
      const taskId=String(result.task_id);
      const songTitle=String(data.title||'My AI Song').trim().slice(0,100)||'My AI Song';
      const registered=await supaFetch('/rest/v1/generated_songs?on_conflict=user_id,task_id',{
        method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify({user_id:user.id,task_id:taskId,title:songTitle,voice,status:'pending'})
      });
      if(!registered.ok)console.warn('[Music archive] Task accepted; pending library registration failed');
      return send(res,200,{id:taskId,status:'processing',libraryRegistered:registered.ok});
    }
    if (path === '/api/ai') {
      const user = await auth(req, res);
      if (!user) return;
      const kind = String(data.kind || '');
      const input = String(data.input || '');
      if (!['lyrics', 'doctor', 'vibe', 'help', 'shayari'].includes(kind) || input.length < 5 || input.length > 12000) return send(res, 400, { error: 'Invalid AI request' });
      const result = await aiGenerate(kind, input);
      return send(res, result.error ? 503 : 200, result);
    }
    if (path === '/api/admin/subscription') {
      const user = await auth(req, res);
      if (!user) return;
      if (!await isAdmin(user.id)) return send(res, 403, { error: 'Admin access required' });
      const targetUserId = String(data.userId || '');
      const plan = String(data.plan || '');
      const limit = data.monthlyLimit;
      const expiresAt = data.expiresAt == null ? null : String(data.expiresAt);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) return send(res, 400, { error: 'Invalid target user ID' });
      if (!['free', 'premium'].includes(plan) || !Number.isSafeInteger(limit) || (plan === 'free' && limit !== 3) || (plan === 'premium' && (limit < 1 || limit > 10000))) return send(res, 400, { error: 'Invalid plan or monthly limit' });
      if (expiresAt !== null && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) return send(res, 400, { error: 'Invalid expiration date' });
      const result = await rpc('admin_set_subscription', {
        p_actor_id: user.id,
        p_target_user_id: targetUserId,
        p_plan: plan,
        p_monthly_limit: limit,
        p_expires_at: expiresAt
      });
      if (!result.ok) return send(res, 503, { error: 'Could not update subscription' });
      if (result.data !== true) return send(res, 403, { error: 'Subscription update rejected' });
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'Unknown endpoint' });
  } catch (error) {
    console.error('[RhymeOrbit API]',req.method,path,error?.name||'Error',error?.message||'unknown');
    const invalid = error.message === 'Request too large' || error.message === 'Invalid JSON';
    return send(res, invalid ? (error.message === 'Request too large' ? 413 : 400) : 500, {
      error: invalid ? error.message : (path.startsWith('/api/music/') ? (error.name === 'TimeoutError' || error.name === 'AbortError' ? 'Music service timed out. Retry recovery; no new generation needed.' : 'Music server error. Check Vercel function logs.') : 'Server request failed'), code: invalid ? 'INVALID_REQUEST' : (error.name === 'TimeoutError' || error.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'SERVER_ERROR')
    });
  }
}
export default handleApi;
