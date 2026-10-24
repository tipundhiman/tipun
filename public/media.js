/* Media studio and uploads. Cloud operations require Supabase and media.sql. */
const mediaKind=(f)=>f.type.startsWith('image/')?'image':f.type.startsWith('video/')?'video':f.type.startsWith('audio/')?'audio':null;
let mediaList=[], textPostList=[];
const baseRenderMedia=render;
render=function(){if(state.page==='media'){$('root').innerHTML=header()+mediaPage()+footer();return}baseRenderMedia()};
const baseGoMedia=go;
go=function(page){if(page==='media'){if(!state.user){state.pending='media';return openAuth('signup')}state.page='media';history.replaceState(null,'','#media');render();window.scrollTo(0,0);loadMedia();return}return baseGoMedia(page)};
const baseHeaderMedia=header;
header=function(){return baseHeaderMedia().replace('</nav>', '<button class="navlink" onclick="go(\'media\')">Media</button></nav>')};
const baseSidebarMedia=appSidebar;
appSidebar=function(){return baseSidebarMedia().replace('<span class="sidebar-label">EXPLORE</span>','<span class="sidebar-label">EXPLORE</span><button class="side-link" onclick="go(\'media\')"><span>▧</span> Media</button>')};
const baseStudioMedia=studio;
studio=function(){let s=baseStudioMedia();if(state.user){s=s.replace('<div id="generatedLyrics"',`<div class="field" style="margin-top:15px"><label for="shayariPrompt">Shayari / poetry prompt</label><input id="shayariPrompt" placeholder="Hindi shayari about first love..."></div><button class="btn sm" onclick="generateShayari()">✧ Generate shayari</button><div id="shayariOutput" style="margin-top:12px"></div><div id="generatedLyrics"`);s=s.replace('AI-powered lyric feedback.','AI-powered lyric feedback.')}return s};
window.generateShayari=()=>{const q=$('shayariPrompt')?.value.trim();if(!q)return toast('Enter a shayari topic');runAI('shayari',q,'shayariOutput')};
function mediaPage(){return appPage(`${heading('MEDIA / YOUR SPACE','Your vibe. <span class="serif">Your orbit.</span>','One place to post your thoughts, photos, videos and sounds. Your posts automatically reach Community.')}
<style>
.ro-media-shell{max-width:1300px;margin:0 auto}.ro-media-postbox{padding:28px;border:1px solid #a77bf455;border-radius:23px;background:radial-gradient(circle at 95% 0%,#7d3e9650,transparent 45%),#17171e;box-shadow:0 12px 35px #0003;animation:roMediaEnter .5s ease both}.ro-media-postbox h2{margin:12px 0}.ro-media-postbox textarea:focus{outline:none;border-color:#e5c9a2!important;box-shadow:0 0 0 3px #e5c9a222}.ro-media-postbox .ro-feed-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:15px}.ro-media-postbox .ro-feed-actions .btn{transition:transform .2s}.ro-media-postbox .ro-feed-actions .btn:hover{transform:translateY(-3px)}@keyframes roMediaEnter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.ro-media-postbox{animation:none}}.ro-media-uploader{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.75fr);gap:22px;align-items:stretch;margin-bottom:36px}.ro-media-drop{display:block;border:1.5px dashed #8e785c;border-radius:18px;background:linear-gradient(140deg,rgba(232,201,158,.08),rgba(232,201,158,.015));padding:28px;text-align:center;cursor:pointer;transition:background .2s,border-color .2s}.ro-media-drop:hover,.ro-media-drop:focus-within{background:rgba(232,201,158,.12);border-color:#e8c99e}.ro-media-drop input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.ro-media-drop-icon{display:block;font-size:32px;margin-bottom:8px}.ro-media-drop strong{display:block;font-size:17px}.ro-media-drop small{display:block;color:#aaa;margin-top:7px}.ro-media-tips{display:flex;flex-direction:column;justify-content:center;gap:12px}.ro-media-tips p{margin:0}.ro-media-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:20px 0 24px}.ro-media-tools input{flex:1;min-width:170px;max-width:330px}.ro-media-filter{border:1px solid #49454b;border-radius:100px;background:transparent;color:inherit;padding:10px 17px;cursor:pointer}.ro-media-filter.active{background:#e8c99e;color:#211b16;border-color:#e8c99e}.ro-media-card{overflow:hidden;padding:0!important;transition:transform .2s,border-color .2s}.ro-media-card:hover{transform:translateY(-3px);border-color:#9c8464}.ro-media-thumb{height:210px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#262330,#111116);overflow:hidden}.ro-media-thumb img,.ro-media-thumb video{height:100%;width:100%;object-fit:cover}.ro-media-thumb audio{width:90%}.ro-media-card-body{padding:18px}.ro-media-card h3{font-size:17px;overflow-wrap:anywhere;margin:0 0 9px}.ro-media-card .card-actions{margin-top:16px;display:flex;gap:8px;flex-wrap:wrap}.ro-media-card .btn{font-size:13px}.ro-media-empty{grid-column:1/-1;padding:54px 25px;text-align:center;border:1px dashed #5d5350;border-radius:20px}.ro-media-empty .big{font-size:40px}.ro-media-preview{font-size:13px;color:#e8c99e;margin:12px 0 0;overflow-wrap:anywhere}@media(max-width:850px){.ro-media-uploader{grid-template-columns:1fr}.ro-media-drop{padding:22px}.ro-media-thumb{height:180px}}@media(prefers-reduced-motion:reduce){.ro-media-card{transition:none}}
/* Orbit Social composer — progressive visual layer, no changes to upload logic */
.ro-media-shell{position:relative;isolation:isolate}
.ro-media-shell:before{content:"";position:absolute;z-index:-1;pointer-events:none;inset:-65px -35px auto;height:490px;background:radial-gradient(ellipse at 30% 15%,rgba(164,99,248,.17),transparent 55%),radial-gradient(ellipse at 90% 60%,rgba(255,184,112,.10),transparent 55%)}
.ro-media-postbox{position:relative;overflow:hidden!important;padding:clamp(22px,4vw,42px)!important;border:1px solid rgba(201,159,255,.35)!important;border-radius:28px!important;background:linear-gradient(135deg,rgba(36,25,54,.98),rgba(19,17,30,.98) 60%,rgba(43,27,44,.97))!important;box-shadow:0 24px 80px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.08)!important;animation:orbitComposerIn .7s cubic-bezier(.2,.8,.2,1) both}
.ro-media-postbox:before{content:"";position:absolute;width:290px;height:290px;border:1px solid rgba(226,187,255,.16);border-radius:50%;right:-125px;top:-155px;box-shadow:0 0 0 40px rgba(226,187,255,.035),0 0 0 92px rgba(226,187,255,.025);pointer-events:none;animation:orbitRing 15s linear infinite}
.ro-media-postbox .eyebrow{display:inline-flex;align-items:center;padding:8px 13px;border:1px solid rgba(229,201,162,.3);border-radius:999px;background:rgba(229,201,162,.09);letter-spacing:.17em}
.ro-media-postbox h2{font-size:clamp(25px,3.2vw,39px);line-height:1.14;letter-spacing:-.04em;margin:22px 0 9px}
.ro-media-postbox .muted{max-width:650px;line-height:1.65}
.ro-media-postbox #mediaTitle{display:block;width:100%;min-height:155px!important;margin-top:23px;padding:21px!important;border:1px solid rgba(255,255,255,.16)!important;border-radius:19px!important;background:rgba(7,8,17,.57)!important;font-size:16px!important;line-height:1.6;transition:border-color .25s,box-shadow .25s,transform .25s;resize:vertical}
.ro-media-postbox #mediaTitle:focus{border-color:#caa4ff!important;box-shadow:0 0 0 4px rgba(167,123,244,.15)!important;transform:translateY(-1px)}
.ro-media-postbox .ro-feed-actions{padding-top:16px;border-top:1px solid rgba(255,255,255,.09);gap:12px!important}
.ro-media-postbox .ro-feed-actions label{border:1px solid rgba(229,201,162,.34);border-radius:999px;padding:12px 18px;background:rgba(255,255,255,.055);cursor:pointer;transition:transform .2s,background .2s,box-shadow .2s}
.ro-media-postbox .ro-feed-actions label:hover{transform:translateY(-3px);background:rgba(167,123,244,.18);box-shadow:0 8px 25px rgba(167,123,244,.14)}
.ro-media-postbox #mediaFile{max-width:230px;font-size:12px;color:#c6bacf}
.ro-media-postbox #roMediaUploadButton{margin-left:auto;border-radius:999px;padding:12px 25px;background:linear-gradient(110deg,#f3d6a7,#d5a8e9);color:#211529;font-weight:800;box-shadow:0 9px 26px rgba(203,148,214,.23);transition:transform .2s,box-shadow .2s}
.ro-media-postbox #roMediaUploadButton:hover{transform:translateY(-3px) scale(1.025);box-shadow:0 14px 33px rgba(203,148,214,.36)}
.ro-media-postbox #roMediaUploadButton:disabled{opacity:.6;transform:none}
.ro-media-preview{padding:10px 14px;margin-top:16px!important;border-radius:12px;background:rgba(255,255,255,.045);color:#d9c3e6!important}
.ro-media-tools{padding:14px 0;gap:10px}.ro-media-filter{transition:background .2s,transform .2s,border-color .2s}.ro-media-filter:hover{transform:translateY(-2px);border-color:#caa4ff}
.ro-media-card{border-radius:21px!important;animation:orbitCardIn .45s ease both}.ro-media-card:hover{transform:translateY(-7px) scale(1.01)!important;box-shadow:0 17px 38px rgba(0,0,0,.26)}
.ro-media-thumb{height:240px!important}.ro-media-thumb img{transition:transform .5s ease}.ro-media-card:hover .ro-media-thumb img{transform:scale(1.055)}
@keyframes orbitComposerIn{from{opacity:0;transform:translateY(25px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes orbitCardIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes orbitRing{to{transform:rotate(360deg)}}
@media(max-width:700px){.ro-media-postbox{padding:20px!important}.ro-media-postbox #roMediaUploadButton{margin-left:0;width:100%}.ro-media-postbox #mediaFile{max-width:100%}.ro-media-postbox .ro-feed-actions{align-items:stretch}.ro-media-thumb{height:185px!important}}
@media(prefers-reduced-motion:reduce){.ro-media-postbox,.ro-media-card,.ro-media-postbox:before{animation:none!important}.ro-media-card,.ro-media-card:hover,.ro-media-thumb img{transition:none!important;transform:none!important}}
</style>
<div class="ro-media-shell">
<div class="ro-feed-composer ro-media-postbox"><span class="eyebrow">✦ YOUR ORBIT · CREATE A POST</span><h2>✨ What's on your mind, ${esc(state.user?.name||'creator')}?</h2><p class="muted">Your space to create, express and share. Drop a thought or add media — it goes live in Community. 🚀</p><form onsubmit="uploadMedia(event)" id="roMediaUploadForm"><textarea id="mediaTitle" maxlength="140" required placeholder="Tell the orbit what's happening… 🎤" aria-label="Post caption" style="width:100%;min-height:110px;background:#0d0e14;color:white;border:1px solid #ffffff26;border-radius:12px;padding:14px;font:inherit;resize:vertical"></textarea><div class="ro-feed-actions"><label class="btn sm" for="mediaFile">＋ Add photo · video · audio</label><input id="mediaFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg" onchange="roMediaPreviewFile()" style="max-width:230px"><button class="btn gold" id="roMediaUploadButton" type="submit">Post to Orbit ↗</button></div><div class="ro-media-preview" id="roMediaFilePreview" aria-live="polite">Photo, video, audio or text-only posts. Max 50 MB per file. Published posts are public.</div></form></div>
<section><div class="section-header"><div><span class="eyebrow">YOUR POSTS</span><h2 class="section-title">Your orbit, your stories</h2></div><button class="btn" onclick="loadMedia()">↻ Refresh</button></div>
<div class="ro-media-tools"><input id="roMediaSearch" aria-label="Search media" placeholder="⌕ Search your uploads..." oninput="roRenderMediaGallery()"><button class="ro-media-filter active" data-kind="all" onclick="roSetMediaFilter('all')">All</button><button class="ro-media-filter" data-kind="image" onclick="roSetMediaFilter('image')">Photos</button><button class="ro-media-filter" data-kind="video" onclick="roSetMediaFilter('video')">Videos</button><button class="ro-media-filter" data-kind="audio" onclick="roSetMediaFilter('audio')">Audio</button><span id="roMediaCount" class="muted small"></span></div>
<div id="mediaLibrary" class="grid3"><div class="empty">Loading your gallery…</div></div></section></div>`)}
function roMediaPreviewFile(){const f=document.getElementById('mediaFile')?.files?.[0];const label=document.getElementById('roMediaFilePreview');if(label)label.textContent=f?f.name+' · '+(f.size/1024/1024).toFixed(2)+' MB':'No file selected'}
let roMediaFilter='all';
function roSetMediaFilter(kind){roMediaFilter=kind;document.querySelectorAll('.ro-media-filter').forEach(b=>b.classList.toggle('active',b.dataset.kind===kind));roRenderMediaGallery()}
function roRenderMediaGallery(){
 const box=document.getElementById('mediaLibrary');if(!box||!sb)return;
 const term=(document.getElementById('roMediaSearch')?.value||'').toLowerCase().trim();
 const combined=[...mediaList,...textPostList];const filtered=combined.filter(m=>(roMediaFilter==='all'||m.kind===roMediaFilter)&&(!term||m.title.toLowerCase().includes(term)));
 const count=document.getElementById('roMediaCount');if(count)count.textContent=filtered.length+' of '+combined.length+' posts';
 box.innerHTML=filtered.length?filtered.map(m=>{
 const url=m.kind==='text'?'':m.storage_path?.startsWith('r2:')?'/api/media/file/'+encodeURIComponent(m.id):sb.storage.from('creator-media').getPublicUrl(m.storage_path).data.publicUrl;
 const preview=m.kind==='text'?'<div style="font-size:45px">✍️</div>':m.kind==='image'?`<img loading="lazy" alt="${esc(m.title)}" src="${esc(url)}">`:m.kind==='video'?`<video controls preload="metadata" src="${esc(url)}"></video>`:`<div style="width:100%;text-align:center"><div style="font-size:45px;margin-bottom:15px">♫</div><audio controls preload="metadata" src="${esc(url)}" style="max-width:95%"></audio></div>`;
 const date=m.created_at?new Date(m.created_at).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'';
 return `<article class="panel ro-media-card"><div class="ro-media-thumb">${preview}</div><div class="ro-media-card-body"><h3>${esc(m.title)}</h3><span class="badge">${esc(m.kind)}</span> <span class="muted small">${esc(date)}</span><div class="card-actions">${m.kind==='text'?'':`<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open / download ↗</a>`}<button class="btn sm" onclick="editMedia('${m.id}',${m.kind==='text'?'true':'false'})">✏ Edit</button><button class="btn sm" onclick="${m.kind==='text'?'deleteTextPost':'deleteMedia'}('${m.id}')">Delete</button></div></div></article>`
 }).join(''):`<div class="ro-media-empty"><div class="big">▧</div><h3>${mediaList.length?'No matching media':'Your gallery is ready'}</h3><p class="muted">${mediaList.length?'Try another filter or search.':'Upload a photo, video or audio file to start your collection.'}</p></div>`;
}

// Music creation is handled only by AI Studio, with server-side quota, rights, and cloud recovery.
async function uploadMedia(e){
 e.preventDefault();if(!sb||!state.user)return toast('Please sign in');
 const f=$('mediaFile').files?.[0],title=$('mediaTitle').value.trim();
 if(!title)return toast('Write something to post');if(!f)return publishTextPost(title);
 const kind=mediaKind(f),allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/wav','audio/ogg'];
 if(!kind||!allowed.includes(f.type)||f.size>50*1024*1024)return toast('Unsupported format or file larger than 50 MB');
 const btn=document.getElementById('roMediaUploadButton');
 if(btn){btn.disabled=true;btn.textContent='Uploading to Cloudflare…'}
 try{
  const session=(await sb.auth.getSession()).data?.session;
  if(!session?.access_token)throw Error('Please sign in again');
  const response=await fetch('/api/media/upload',{
   method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':f.type,'X-RhymeOrbit-Title':encodeURIComponent(title)},body:f
  });
  const result=await response.json().catch(()=>({error:'Upload service unavailable'}));
  if(!response.ok)throw Error(result.error||'Upload failed');
  $('mediaTitle').value='';$('mediaFile').value='';roMediaPreviewFile();
  toast(result.warning||'Posted to Cloudflare R2 + Community! 🚀');await loadMedia();
 }catch(error){toast('Upload failed: '+error.message)}
 finally{if(btn){btn.disabled=false;btn.textContent='Post to Orbit ↗'}}
}
async function loadMedia(){if(!sb||!state.user)return;const {data,error}=await sb.from('creator_media').select('id,owner,storage_path,kind,title,mime_type,created_at').eq('owner',state.user.id).order('created_at',{ascending:false}).limit(100);const box=$('mediaLibrary');if(!box)return;if(error){box.innerHTML=`<div class="note">${esc(error.message)} — run media.sql in Supabase.</div>`;return}mediaList=data||[];const t=await sb.from('community_posts').select('id,caption,created_at').eq('user_id',state.user.id).is('media_path',null).order('created_at',{ascending:false}).limit(100);textPostList=(t.data||[]).map(x=>({...x,title:x.caption,kind:'text'}));roRenderMediaGallery()}
async function publishTextPost(caption){const btn=document.getElementById('roMediaUploadButton');if(btn)btn.disabled=true;try{const {error}=await sb.from('community_posts').insert({user_id:state.user.id,author_name:(state.user.name||'Creator').slice(0,80),caption});if(error)throw error;document.getElementById('mediaTitle').value='';toast('Text post published to Community 🚀');await loadMedia()}catch(e){toast('Could not publish: '+e.message)}finally{if(btn)btn.disabled=false}}
async function editMedia(id,isText=false){if(!state.user)return;const item=isText?textPostList.find(x=>x.id===id):mediaList.find(x=>x.id===id);if(!item)return;const caption=prompt('Edit your post caption:',item.title||'');if(caption===null)return;const value=caption.trim();if(!value||value.length>140)return toast('Caption must be 1–140 characters');if(isText){const {error}=await sb.from('community_posts').update({caption:value}).eq('id',id).eq('user_id',state.user.id);if(error)return toast(error.message)}else{const {error}=await sb.from('creator_media').update({title:value}).eq('id',id).eq('owner',state.user.id);if(error)return toast(error.message);const r2=item.storage_path?.startsWith('r2:');const sync=await sb.from('community_posts').update({caption:value}).eq('user_id',state.user.id).eq('media_bucket',r2?'r2':'creator-media').eq('media_path',r2?item.storage_path.slice(3):item.storage_path);if(sync.error)return toast('Media updated; Community sync failed: '+sync.error.message)}toast('Post updated ✨');await loadMedia()}
async function deleteTextPost(id){if(!confirm('Delete this post?'))return;const {error}=await sb.from('community_posts').delete().eq('id',id).eq('user_id',state.user.id);if(error)return toast(error.message);toast('Post deleted');await loadMedia()}
async function deleteMedia(id){const m=mediaList.find(x=>x.id===id);if(!m||!confirm('Delete this media permanently?'))return;if(m.storage_path?.startsWith('r2:')){try{const session=(await sb.auth.getSession()).data?.session;if(!session?.access_token)throw Error('Please sign in again');const response=await fetch('/api/media/delete',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({id})});const result=await response.json();if(!response.ok)throw Error(result.error||'Delete failed');toast(result.warning||'Media deleted');await loadMedia()}catch(error){toast(error.message)}return}const {error:postError}=await sb.from('community_posts').delete().eq('user_id',state.user.id).eq('media_bucket','creator-media').eq('media_path',m.storage_path);if(postError)return toast('Could not remove Community post: '+postError.message);const {error}=await sb.storage.from('creator-media').remove([m.storage_path]);if(error)return toast(error.message);const d=await sb.from('creator_media').delete().eq('id',id);if(d.error)return toast(d.error.message);toast('Media deleted');await loadMedia()}

/* RhymeOrbit: selected language for AI generation */
(function () {
  function selectedLanguage() {
    return document.getElementById("songLanguage")?.value || "Hindi";
  }

  function languagePrompt(topic, type) {
    const language = selectedLanguage();

    return [
      "Create " + type + " in " + language + ".",
      "User's topic: " + topic,
      "Use natural, authentic " + language + " vocabulary.",
      "Maintain meaningful rhymes, emotion and flow.",
      "Avoid forced rhymes, awkward expressions and random words.",
      "Do not switch languages unless the user requests it.",
      "For Haryanvi, prefer natural Sonipat-Rohtak style.",
      "For Hindi or Haryanvi, prefer Devanagari script.",
      "Return the creative writing, not a long introduction."
    ].join("\n");
  }

  window.generateShayari = function () {
    const topic = document.getElementById("shayariPrompt")?.value.trim();

    if (!topic) return toast("Enter a shayari topic");

    runAI(
      "shayari",
      languagePrompt(topic, "expressive shayari"),
      "shayariOutput"
    );
  };

  window.generateLyrics = function () {
    const topic = document.getElementById("generatePrompt")?.value.trim();

    if (!topic) return toast("Describe the song first");

    runAI(
      "lyrics",
      languagePrompt(topic, "original song lyrics"),
      "generatedLyrics"
    );
  };
})();


const roOriginalMediaRender=render;
render=function(){roOriginalMediaRender();if(state.page==='media')loadMedia()};
window.addEventListener('hashchange',()=>{const target=location.hash.slice(1);if(target==='media'&&state.page!=='media')go('media');else if(target&&target!==state.page&&['home','studio','projects','listen','discover','community','profile','help'].includes(target))go(target)});
