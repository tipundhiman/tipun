import {randomUUID} from 'node:crypto';
const env=k=>process.env[k]||'';
const limits=new Map();
const send=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
async function body(req){let data='';for await(const c of req){data+=c;if(data.length>25000)throw new Error('Request too large')}return JSON.parse(data||'{}')}
function rate(req,res){const key=(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').toString().split(',')[0],now=Date.now(),v=limits.get(key)||{n:0,t:now};if(now-v.t>60000){v.n=0;v.t=now}v.n++;limits.set(key,v);if(v.n>25){send(res,429,{error:'Too many requests. Try again later.'});return false}return true}
const config=()=>({url:env('SUPABASE_URL').replace(/\/$/,''),anon:env('SUPABASE_ANON_KEY'),service:env('SUPABASE_SERVICE_ROLE_KEY')});
async function userFromToken(token){const {url,anon}=config();if(!url||!anon||!token)return null;const r=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token},signal:AbortSignal.timeout(9000)});return r.ok?await r.json():null}
async function supaFetch(endpoint,opts={}){const c=config();const r=await fetch(c.url+endpoint,{...opts,headers:{apikey:c.service,Authorization:'Bearer '+c.service,'Content-Type':'application/json',...opts.headers},signal:AbortSignal.timeout(10000)});const txt=await r.text();let data;try{data=JSON.parse(txt)}catch{data={error:txt.slice(0,200)}}return {ok:r.ok,status:r.status,data}}
async function aiGenerate(kind,input){const key=env('GEMINI_API_KEY');if(!key)return {error:'AI is not configured. Add GEMINI_API_KEY to server environment.'};const prompts={lyrics:'You are a creative songwriting collaborator. Write original song lyrics based on the user brief. Avoid copying existing songs. Respond in the requested language. Output clear sections.',doctor:'Analyze the supplied lyrics. Give specific, constructive notes on rhyme, meter, hooks, originality and structure. Preserve original lyrics; do not rewrite unless asked.',vibe:'Create an actionable original song concept: theme, story arc, genre, tempo suggestion, instruments, hook idea and structure. Do not claim to create audio.',help:'You are RhymeOrbit support assistant. Explain that AI writing, music generation through a configured provider, uploads, and mutual match messaging require live provider configuration. Never claim a feature works without configuration.',shayari:'Write original expressive shayari or poetry based on the user prompt. Respect requested Hindi, Urdu, Punjabi or English language and mood. Avoid copyrighted imitation.'};if(!prompts[kind])return {error:'Invalid AI mode'};const model=env('GEMINI_MODEL')||'gemini-2.5-flash-lite';const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:prompts[kind]}]},contents:[{parts:[{text:input.slice(0,12000)}]}],generationConfig:{maxOutputTokens:1100,temperature:.75}}),signal:AbortSignal.timeout(30000)});
const result=await r.json();if(!r.ok)return {error:result.error?.message||'AI provider failed'};return {text:result.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'No text returned'};}
export async function handleApi(req,res){try{
  if(req.method==='GET'&&req.url==='/api/health')return send(res,200,{ok:true,authConfigured:!!(env('SUPABASE_URL')&&env('SUPABASE_ANON_KEY')),aiConfigured:!!env('GEMINI_API_KEY')});
  if(req.method==='GET'&&req.url?.startsWith('/api/youtube?')){
    if(!rate(req,res))return;
    const key=env('YOUTUBE_API_KEY');if(!key)return send(res,503,{error:'YouTube API is not configured'});
    const q=new URL(req.url,'http://localhost').searchParams.get('q')?.trim()||'';
    if(q.length<2||q.length>100)return send(res,400,{error:'Search must be 2–100 characters'});
    const u=new URL('https://www.googleapis.com/youtube/v3/search');
    for(const [k,v] of Object.entries({part:'snippet',type:'video',videoEmbeddable:'true',safeSearch:'moderate',maxResults:'9',q,key}))u.searchParams.set(k,v);
    const r=await fetch(u,{signal:AbortSignal.timeout(12000)});const j=await r.json();
    if(!r.ok)return send(res,502,{error:'YouTube search unavailable or quota exceeded'});
    const items=(j.items||[]).filter(x=>/^[a-zA-Z0-9_-]{11}$/.test(x.id?.videoId||'')).map(x=>({id:x.id.videoId,title:x.snippet?.title||'',channel:x.snippet?.channelTitle||'',thumbnail:x.snippet?.thumbnails?.medium?.url||''}));
    return send(res,200,{items});
  }
  if(req.method==='GET'&&req.url==='/api/music/status')return send(res,200,{configured:!!env('REPLICATE_API_TOKEN'),provider:'Replicate MusicGen',supportsVocals:false});
  if(req.method==='GET'&&req.url?.startsWith('/api/music/prediction/')){
    if(!rate(req,res))return;
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!await userFromToken(token))return send(res,401,{error:'Sign in required'});
    const id=req.url.split('/').pop();
    if(!/^[a-zA-Z0-9_-]{8,80}$/.test(id))return send(res,400,{error:'Invalid prediction ID'});
    if(!env('REPLICATE_API_TOKEN'))return send(res,503,{error:'Music generation not configured'});
    const r=await fetch('https://api.replicate.com/v1/predictions/'+id,{headers:{Authorization:'Bearer '+env('REPLICATE_API_TOKEN')},signal:AbortSignal.timeout(12000)});
    const j=await r.json();
    if(!r.ok)return send(res,502,{error:'Could not read music generation status'});
    return send(res,200,{id:j.id,status:j.status,output:j.output,error:j.error||null});
  }
  if(req.method==='GET'&&req.url==='/api/config')return send(res,200,{supabaseUrl:env('SUPABASE_URL')||null,supabaseAnonKey:env('SUPABASE_ANON_KEY')||null,usernameLogin:!!env('SUPABASE_SERVICE_ROLE_KEY')});
  if(req.method!=='POST')return send(res,404,{error:'Not found'});if(!rate(req,res))return;
  const data=await body(req);
  if(req.url==='/api/username-login'){
    const {url,anon,service}=config();if(!url||!anon||!service)return send(res,503,{error:'Authentication not configured'});
    const username=String(data.username||'').trim().toLowerCase(),password=String(data.password||'');if(!/^[a-z0-9_]{3,24}$/.test(username)||password.length<8)return send(res,400,{error:'Invalid username or password'});
    const lookup=await supaFetch('/rest/v1/profiles?username=eq.'+encodeURIComponent(username)+'&select=email&limit=1');if(!lookup.ok||!lookup.data?.[0]?.email)return send(res,401,{error:'Invalid username or password'});
    const r=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:lookup.data[0].email,password}),signal:AbortSignal.timeout(10000)});const j=await r.json();if(!r.ok)return send(res,401,{error:'Invalid username or password'});return send(res,200,{access_token:j.access_token,refresh_token:j.refresh_token,expires_in:j.expires_in,user:j.user});
  }
  if(req.url==='/api/music/generate'){
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!await userFromToken(token))return send(res,401,{error:'Sign in required'});
    const prompt=String(data.prompt||'').trim(),duration=Number(data.duration||15);
    if(prompt.length<10||prompt.length>1000||![8,15,30].includes(duration))return send(res,400,{error:'Enter a 10–1000 character prompt and supported duration'});
    if(!env('REPLICATE_API_TOKEN'))return send(res,503,{error:'Add REPLICATE_API_TOKEN to enable instrumental music generation'});
    const r=await fetch('https://api.replicate.com/v1/models/meta/musicgen/predictions',{method:'POST',headers:{Authorization:'Bearer '+env('REPLICATE_API_TOKEN'),'Content-Type':'application/json','Prefer':'wait=1'},body:JSON.stringify({input:{prompt,duration,output_format:'mp3'}}),signal:AbortSignal.timeout(20000)});
    const j=await r.json();if(!r.ok)return send(res,502,{error:j.detail||j.title||'Music provider request failed'});
    return send(res,202,{id:j.id,status:j.status,output:j.output||null});
  }
  if(req.url==='/api/ai'){
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const user=await userFromToken(token);if(!user)return send(res,401,{error:'Please log in to use AI Studio'});
    const kind=String(data.kind||''),input=String(data.input||'');if(!['lyrics','doctor','vibe','help','shayari'].includes(kind)||input.length<5||input.length>12000)return send(res,400,{error:'Invalid AI request'});
    const result=await aiGenerate(kind,input);return send(res,result.error?503:200,result);
  }
  return send(res,404,{error:'Unknown endpoint'});
}catch(e){send(res,e.message==='Request too large'?413:500,{error:e.message==='Request too large'?e.message:'Server request failed'})}}
// Vercel Node.js Function entrypoint.
export default handleApi;
