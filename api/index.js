
import { randomUUID } from 'node:crypto';

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

async function cloudSongs(userId) {
  return supaFetch('/rest/v1/generated_songs?user_id=eq.'+encodeURIComponent(userId)+'&select=task_id,title,voice,status,storage_path,created_at&order=created_at.desc&limit=100');
}
async function signedAudio(path) {
  if(!path)return null;
  const c=config();
  const response=await fetch(c.url+'/storage/v1/object/sign/song-audio/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'POST',headers:{apikey:c.service,Authorization:'Bearer '+c.service,'Content-Type':'application/json'},
    body:JSON.stringify({expiresIn:3600}),signal:AbortSignal.timeout(8000)
  });
  const data=await response.json().catch(()=>({}));
  return response.ok&&data.signedURL?c.url+'/storage/v1'+data.signedURL:null;
}
async function trebleAudio(id) {
  const headers={Authorization:'Bearer '+env('TREBLO_API_KEY')};
  const status=await fetch('https://api.treblo.com/v1/generations/status/'+encodeURIComponent(id),{headers,signal:AbortSignal.timeout(10000)});
  if(!status.ok)throw Error('Treblo status lookup failed');
  const st=await status.json();
  if(st.status!=='SUCCESS'&&st.state!=='SUCCESS')return null;
  const result=await fetch('https://api.treblo.com/v1/generations/'+encodeURIComponent(id),{headers,signal:AbortSignal.timeout(10000)});
  if(!result.ok)throw Error('Treblo song lookup failed');
  const song=await result.json();
  return (song.song_paths||[]).find(url=>typeof url==='string'&&url.startsWith('https://'))||null;
}
async function archiveAudio(userId,id,url) {
  const c=config(),path=userId+'/'+id+'.mp3';
  const download=await fetch(url,{signal:AbortSignal.timeout(16000)});
  if(!download.ok)throw Error('Treblo audio download failed');
  const mime=(download.headers.get('content-type')||'').toLowerCase();
  if(!mime.includes('audio/')&&!mime.includes('octet-stream'))throw Error('Provider returned non-audio data');
  if(Number(download.headers.get('content-length')||0)>20_000_000)throw Error('Audio exceeds 20 MB storage limit');
  const bytes=await download.arrayBuffer();
  if(bytes.byteLength>20_000_000||bytes.byteLength<1000)throw Error('Invalid audio size');
  const upload=await fetch(c.url+'/storage/v1/object/song-audio/'+path,{
    method:'POST',headers:{apikey:c.service,Authorization:'Bearer '+c.service,'Content-Type':mime.includes('mpeg')?'audio/mpeg':'application/octet-stream','x-upsert':'true'},
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
  if (!user?.id) { send(res, 401, { error: 'Sign in required' }); return null; }
  return user;
}
async function isAdmin(userId) {
  const result = await supaFetch('/rest/v1/admin_users?user_id=eq.' + encodeURIComponent(userId) + '&select=user_id&limit=1');
  if (!result.ok) throw new Error('Admin authorization unavailable');
  return Array.isArray(result.data) && result.data.length === 1;
}
async function aiGenerate(kind, input) {
  const key = env('GEMINI_API_KEY');
  if (!key) return { error: 'AI is not configured. Add GEMINI_API_KEY to server environment.' };
  const prompts = {
    lyrics: 'You are a creative songwriting collaborator. Write original song lyrics based on the user brief. Avoid copying existing songs. Respond in the requested language. Output clear sections.',
    doctor: 'Analyze the supplied lyrics. Give specific, constructive notes on rhyme, meter, hooks, originality and structure. Preserve original lyrics; do not rewrite unless asked.',
    vibe: 'Create an actionable original song concept: theme, story arc, genre, tempo suggestion, instruments, hook idea and structure. Do not claim to create audio.',
    help: 'You are RhymeOrbit support assistant. Explain that AI writing, music generation through a configured provider, uploads, and mutual match messaging require live provider configuration. Never claim a feature works without configuration.',
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
  if (!response.ok) return { error: result.error?.message || 'AI provider failed' };
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
  try {
    const { path, raw } = pathOf(req);
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
      return send(res, 200, {
        configured: false,
        provider: null,
        supportsVocals: false,
        message: 'Full-song generation is not enabled yet.'
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
      const limit = !active ? 0 : (!s || s.plan === 'free' ? 3 : (s.monthly_song_limit ?? 0));
      const used = u?.songs_used || 0;
      const reserved = u?.songs_reserved || 0;
      return send(res, 200, { plan: s?.plan || 'free', monthlyLimit: limit, used, reserved, remaining: Math.max(0, limit - used - reserved), monthStart: month });
    }

    if (req.method === 'GET' && path === '/api/music/library') {
      const user=await auth(req,res);if(!user)return;
      const found=await cloudSongs(user.id);
      if(!found.ok)return send(res,503,{error:'Cloud song library not set up. Run the Supabase migration SQL first.'});
      const items=await Promise.all(found.data.map(async row=>({
        id:row.task_id,title:row.title,voice:row.voice,status:row.status,
        url:await signedAudio(row.storage_path),cloudSaved:!!row.storage_path
      })));
      return send(res,200,{items});
    }
    if (req.method === 'POST' && path === '/api/music/library') {
      const user=await auth(req,res);if(!user)return;
      if(!await isAdmin(user.id))return send(res,403,{error:'Admin testing only'});
      const id=String(data.taskId||'').trim();
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return send(res,400,{error:'Invalid Treblo task ID'});
      const existing=await supaFetch('/rest/v1/generated_songs?user_id=eq.'+encodeURIComponent(user.id)+'&task_id=eq.'+encodeURIComponent(id)+'&select=storage_path&limit=1');
      if(!existing.ok)return send(res,503,{error:'Cloud library table missing. Run the SQL migration.'});
      let storagePath=existing.data?.[0]?.storage_path||null;
      let warning=null;
      if(!storagePath){
        try{const url=await trebleAudio(id);if(url)storagePath=await archiveAudio(user.id,id,url);else warning='Treblo song still processing; try recovery again when ready.'}
        catch(e){warning=e.message||'Audio archival failed'}
      }
      const title=String(data.title||'My AI Song').trim().slice(0,100)||'My AI Song';
      const voice=['male','female','duet','auto'].includes(data.voice)?data.voice:'auto';
      const save=await supaFetch('/rest/v1/generated_songs?on_conflict=user_id,task_id',{
        method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
        body:JSON.stringify({user_id:user.id,task_id:id,title,voice,status:storagePath?'ready':'pending',storage_path:storagePath})
      });
      if(!save.ok)return send(res,503,{error:'Unable to save cloud song record',detail:save.data?.message});
      return send(res,200,{id,cloudSaved:!!storagePath,warning,url:await signedAudio(storagePath)});
    }
    if (req.method === 'GET' && path === '/api/music/history') {
      if (!rate(req, res)) return;
      const user = await auth(req, res);
      if (!user) return;
      const result = await supaFetch('/rest/v1/music_generations?user_id=eq.' + encodeURIComponent(user.id) + '&select=id,status,credit_status,created_at,completed_at,output_url&order=created_at.desc&limit=30');
      return result.ok ? send(res, 200, { items: result.data }) : send(res, 503, { error: 'Music history unavailable' });
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
      if (!await isAdmin(user.id)) return send(res, 403, { error: 'Admin test only' });
      const id = decodeURIComponent(path.slice('/api/music/prediction/'.length));
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return send(res, 400, { error: 'Invalid task ID' });
      if (!env('TREBLO_API_KEY')) return send(res, 503, { error: 'Treblo key missing' });
      const headers = { Authorization: 'Bearer ' + env('TREBLO_API_KEY') };
      const response = await fetch('https://api.treblo.com/v1/generations/status/' + encodeURIComponent(id), {
        headers, signal: AbortSignal.timeout(12000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return send(res, 502, { error: result.error?.message || result.detail || 'Treblo status unavailable' });
      const raw = typeof result === 'string' ? result : (result.status || result.state || '');
      if (raw === 'FAILURE') return send(res, 200, { id, status: 'failed', error: result.error_message || 'Treblo generation failed' });
      if (raw !== 'SUCCESS') return send(res, 200, { id, status: 'processing' });
      const finished = await fetch('https://api.treblo.com/v1/generations/' + encodeURIComponent(id), {
        headers, signal: AbortSignal.timeout(12000)
      });
      const song = await finished.json().catch(() => ({}));
      if (!finished.ok) return send(res, 502, { error: song.error_message || 'Treblo completed but audio lookup failed' });
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
      if (!await isAdmin(user.id)) return send(res, 403, { error: 'Music generation is in admin testing' });
      if (!env('TREBLO_API_KEY')) return send(res, 503, { error: 'Treblo API key is not configured' });
      const lyrics = String(data.lyrics || '').trim();
      const voice = ['male','female','duet','auto'].includes(data.voice) ? data.voice : 'auto';
      const prompt = String(data.prompt || '').trim();
      if (lyrics.length < 20 || lyrics.length > 5000 || prompt.length < 5 || prompt.length > 1024) return send(res, 400, { error: 'Enter lyrics (20–5000 characters) and music style (5–1024 characters)' });
      const response = await fetch('https://api.treblo.com/v1/generations/v3', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env('TREBLO_API_KEY'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: voice === 'auto' ? prompt : prompt + '. Vocal direction: ' + (voice === 'duet' ? 'male and female duet, distinct alternating singers' : voice + ' lead singer only') + '.', lyrics, instrumental: false }),
        signal: AbortSignal.timeout(25000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.task_id) return send(res, response.status === 429 ? 429 : 502, { error: result.error?.message || result.detail || result.message || 'Treblo could not start song generation' });
      return send(res, 200, { id: String(result.task_id), status: 'processing' });
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
    const invalid = error.message === 'Request too large' || error.message === 'Invalid JSON';
    return send(res, invalid ? (error.message === 'Request too large' ? 413 : 400) : 500, {
      error: invalid ? error.message : 'Server request failed'
    });
  }
}
export default handleApi;
