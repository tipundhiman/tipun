/* Media studio and uploads. Cloud operations require Supabase and media.sql. */
const mediaKind=(f)=>f.type.startsWith('image/')?'image':f.type.startsWith('video/')?'video':f.type.startsWith('audio/')?'audio':null;
let mediaList=[], musicJob=null, musicTimer=null;
const baseRenderMedia=render;
render=function(){if(state.page==='media'){$('root').innerHTML=header()+mediaPage()+footer();return}baseRenderMedia()};
const baseGoMedia=go;
go=function(page){if(page==='media'){if(!state.user){state.pending='media';return openAuth('signup')}state.page='media';history.replaceState(null,'','#media');render();window.scrollTo(0,0);loadMedia();roMediaSongList();return}return baseGoMedia(page)};
const baseHeaderMedia=header;
header=function(){return baseHeaderMedia().replace('</nav>', '<button class="navlink" onclick="go(\'media\')">Media & Music</button></nav>')};
const baseSidebarMedia=appSidebar;
appSidebar=function(){return baseSidebarMedia().replace('<span class="sidebar-label">EXPLORE</span>','<span class="sidebar-label">EXPLORE</span><button class="side-link" onclick="go(\'media\')"><span>▧</span> Media & Music</button>')};
const baseStudioMedia=studio;
studio=function(){let s=baseStudioMedia();if(state.user){s=s.replace('<div id="generatedLyrics"',`<div class="field" style="margin-top:15px"><label for="shayariPrompt">Shayari / poetry prompt</label><input id="shayariPrompt" placeholder="Hindi shayari about first love..."></div><button class="btn sm" onclick="generateShayari()">✧ Generate shayari</button><div id="shayariOutput" style="margin-top:12px"></div><div id="generatedLyrics"`);s=s.replace('AI-powered lyric feedback.','AI-powered lyric feedback.')}return s};
window.generateShayari=()=>{const q=$('shayariPrompt')?.value.trim();if(!q)return toast('Enter a shayari topic');runAI('shayari',q,'shayariOutput')};
function mediaPage(){return appPage(`${heading('MEDIA LIBRARY','Your creative <span class="serif">gallery.</span>','A beautiful home for the photos, videos and audio you upload. AI-generated songs belong in My Studio.')}
<style>
.ro-media-shell{max-width:1300px;margin:0 auto}.ro-media-uploader{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.75fr);gap:22px;align-items:stretch;margin-bottom:36px}.ro-media-drop{display:block;border:1.5px dashed #8e785c;border-radius:18px;background:linear-gradient(140deg,rgba(232,201,158,.08),rgba(232,201,158,.015));padding:28px;text-align:center;cursor:pointer;transition:background .2s,border-color .2s}.ro-media-drop:hover,.ro-media-drop:focus-within{background:rgba(232,201,158,.12);border-color:#e8c99e}.ro-media-drop input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.ro-media-drop-icon{display:block;font-size:32px;margin-bottom:8px}.ro-media-drop strong{display:block;font-size:17px}.ro-media-drop small{display:block;color:#aaa;margin-top:7px}.ro-media-tips{display:flex;flex-direction:column;justify-content:center;gap:12px}.ro-media-tips p{margin:0}.ro-media-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:20px 0 24px}.ro-media-tools input{flex:1;min-width:170px;max-width:330px}.ro-media-filter{border:1px solid #49454b;border-radius:100px;background:transparent;color:inherit;padding:10px 17px;cursor:pointer}.ro-media-filter.active{background:#e8c99e;color:#211b16;border-color:#e8c99e}.ro-media-card{overflow:hidden;padding:0!important;transition:transform .2s,border-color .2s}.ro-media-card:hover{transform:translateY(-3px);border-color:#9c8464}.ro-media-thumb{height:210px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#262330,#111116);overflow:hidden}.ro-media-thumb img,.ro-media-thumb video{height:100%;width:100%;object-fit:cover}.ro-media-thumb audio{width:90%}.ro-media-card-body{padding:18px}.ro-media-card h3{font-size:17px;overflow-wrap:anywhere;margin:0 0 9px}.ro-media-card .card-actions{margin-top:16px;display:flex;gap:8px;flex-wrap:wrap}.ro-media-card .btn{font-size:13px}.ro-media-empty{grid-column:1/-1;padding:54px 25px;text-align:center;border:1px dashed #5d5350;border-radius:20px}.ro-media-empty .big{font-size:40px}.ro-media-preview{font-size:13px;color:#e8c99e;margin:12px 0 0;overflow-wrap:anywhere}@media(max-width:850px){.ro-media-uploader{grid-template-columns:1fr}.ro-media-drop{padding:22px}.ro-media-thumb{height:180px}}@media(prefers-reduced-motion:reduce){.ro-media-card{transition:none}}
</style>
<div class="ro-media-shell">
<div class="ro-media-uploader">
<section class="panel"><span class="eyebrow">UPLOAD MEDIA</span><h2 style="margin:12px 0">Share your next creation</h2><p class="muted">Upload original photography, artwork, videos or audio files.</p>
<form onsubmit="uploadMedia(event)" id="roMediaUploadForm">
<div class="field"><label for="mediaTitle">Media title</label><input id="mediaTitle" maxlength="140" required placeholder="Give your upload a memorable title"></div>
<label class="ro-media-drop" for="mediaFile"><span class="ro-media-drop-icon">↥</span><strong>Choose a file to upload</strong><small>JPG, PNG, WEBP, GIF, MP4, WEBM, MP3, WAV or OGG · Up to 50 MB</small><input id="mediaFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg" onchange="roMediaPreviewFile()" required></label>
<div class="ro-media-preview" id="roMediaFilePreview" aria-live="polite">No file selected</div>
<button class="btn gold" id="roMediaUploadButton" type="submit" style="margin-top:18px">↑ Upload to my gallery</button>
</form></section>
<aside class="panel ro-media-tips"><span class="eyebrow">YOUR CREATIVE SPACE</span><h3 style="margin:0">Everything in one gallery.</h3><p class="muted">✦ Beautiful previews for photos and videos</p><p class="muted">♫ Audio uploads with a built-in player</p><p class="muted">↗ Open or download your files anytime</p><div class="note">Only upload media you own or have permission to publish. Uploaded portfolio media may be publicly accessible.</div></aside>
</div>
<section><div class="section-header"><div><span class="eyebrow">MY UPLOADS</span><h2 class="section-title">Media gallery</h2></div><button class="btn" onclick="loadMedia()">↻ Refresh</button></div>
<div class="ro-media-tools"><input id="roMediaSearch" aria-label="Search media" placeholder="⌕ Search your uploads..." oninput="roRenderMediaGallery()"><button class="ro-media-filter active" data-kind="all" onclick="roSetMediaFilter('all')">All</button><button class="ro-media-filter" data-kind="image" onclick="roSetMediaFilter('image')">Photos</button><button class="ro-media-filter" data-kind="video" onclick="roSetMediaFilter('video')">Videos</button><button class="ro-media-filter" data-kind="audio" onclick="roSetMediaFilter('audio')">Audio</button><span id="roMediaCount" class="muted small"></span></div>
<div id="mediaLibrary" class="grid3"><div class="empty">Loading your gallery…</div></div></section></div>`)}
function roMediaPreviewFile(){const f=document.getElementById('mediaFile')?.files?.[0];const label=document.getElementById('roMediaFilePreview');if(label)label.textContent=f?f.name+' · '+(f.size/1024/1024).toFixed(2)+' MB':'No file selected'}
let roMediaFilter='all';
function roSetMediaFilter(kind){roMediaFilter=kind;document.querySelectorAll('.ro-media-filter').forEach(b=>b.classList.toggle('active',b.dataset.kind===kind));roRenderMediaGallery()}
function roRenderMediaGallery(){
 const box=document.getElementById('mediaLibrary');if(!box||!sb)return;
 const term=(document.getElementById('roMediaSearch')?.value||'').toLowerCase().trim();
 const filtered=mediaList.filter(m=>(roMediaFilter==='all'||m.kind===roMediaFilter)&&(!term||m.title.toLowerCase().includes(term)));
 const count=document.getElementById('roMediaCount');if(count)count.textContent=filtered.length+' of '+mediaList.length+' uploads';
 box.innerHTML=filtered.length?filtered.map(m=>{
 const url=sb.storage.from('creator-media').getPublicUrl(m.storage_path).data.publicUrl;
 const preview=m.kind==='image'?`<img loading="lazy" alt="${esc(m.title)}" src="${esc(url)}">`:m.kind==='video'?`<video controls preload="metadata" src="${esc(url)}"></video>`:`<div style="width:100%;text-align:center"><div style="font-size:45px;margin-bottom:15px">♫</div><audio controls preload="metadata" src="${esc(url)}" style="max-width:95%"></audio></div>`;
 const date=m.created_at?new Date(m.created_at).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'';
 return `<article class="panel ro-media-card"><div class="ro-media-thumb">${preview}</div><div class="ro-media-card-body"><h3>${esc(m.title)}</h3><span class="badge">${esc(m.kind)}</span> <span class="muted small">${esc(date)}</span><div class="card-actions"><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open / download ↗</a><button class="btn sm" onclick="deleteMedia('${m.id}')">Delete</button></div></div></article>`
 }).join(''):`<div class="ro-media-empty"><div class="big">▧</div><h3>${mediaList.length?'No matching media':'Your gallery is ready'}</h3><p class="muted">${mediaList.length?'Try another filter or search.':'Upload a photo, video or audio file to start your collection.'}</p></div>`;
}

async function authToken(){if(!sb)return null;return (await sb.auth.getSession()).data.session?.access_token||null}
async function createMusic(e){e.preventDefault();const token=await authToken();if(!token)return toast('Please sign in first');const el=$('musicResult');el.innerHTML='<div class="note loading">Submitting music generation…</div>';try{const r=await fetch('/api/music/generate',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({prompt:$('musicPrompt').value.trim(),duration:Number($('musicDuration').value)})});const j=await r.json();if(!r.ok)throw Error(j.error||'Could not start generation');musicJob=j.id;showMusicStatus(j);if(musicTimer)clearInterval(musicTimer);musicTimer=setInterval(checkMusic,4500)}catch(err){el.innerHTML=`<div class="note">${esc(err.message)}</div>`}}
async function checkMusic(){if(!musicJob)return;const token=await authToken();if(!token)return;try{const r=await fetch('/api/music/prediction/'+encodeURIComponent(musicJob),{headers:{Authorization:'Bearer '+token}});const j=await r.json();if(!r.ok)throw Error(j.error||'Could not check status');showMusicStatus(j);if(['succeeded','failed','canceled'].includes(j.status)){clearInterval(musicTimer);musicTimer=null}}catch(e){clearInterval(musicTimer);musicTimer=null;$('musicResult').textContent=e.message}}
function showMusicStatus(j){const el=$('musicResult');if(!el)return;const url=Array.isArray(j.output)?j.output[0]:typeof j.output==='string'?j.output:null;const safe=url&&/^https:\/\//.test(url)?url:null;el.innerHTML=`<div class="note"><b>Status: ${esc(j.status||'starting')}</b>${j.error?`<p>${esc(j.error)}</p>`:''}${j.status==='succeeded'&&safe?`<div style="margin-top:15px"><audio controls preload="none" src="${esc(safe)}" style="width:100%"></audio><p><a class="btn gold" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">↓ Open / save generated audio</a></p><p class="muted small">If the provider opens audio in a new tab, use your browser’s Save audio option. Provider links may expire.</p></div>`:''}</div>`}
async function uploadMedia(e){e.preventDefault();if(!sb||!state.user)return toast('Please sign in');const f=$('mediaFile').files?.[0],title=$('mediaTitle').value.trim();if(!f||!title)return toast('Choose a file and title');const kind=mediaKind(f),allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/wav','audio/ogg'];if(!kind||!allowed.includes(f.type)||f.size>50*1024*1024)return toast('Unsupported format or file larger than 50 MB');const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/wav':'wav','audio/ogg':'ogg'})[f.type];const path=state.user.id+'/'+crypto.randomUUID()+'.'+ext;const uploadButton=document.getElementById('roMediaUploadButton');if(uploadButton){uploadButton.disabled=true;uploadButton.textContent='Uploading…'}toast('Uploading media…');const uploaded=await sb.storage.from('creator-media').upload(path,f,{contentType:f.type,upsert:false});if(uploaded.error){if(uploadButton){uploadButton.disabled=false;uploadButton.textContent='↑ Upload to my gallery'}return toast('Upload failed: '+uploaded.error.message)}const {error}=await sb.from('creator_media').insert({owner:state.user.id,storage_path:path,title,kind,mime_type:f.type,size_bytes:f.size});if(error){await sb.storage.from('creator-media').remove([path]);if(uploadButton){uploadButton.disabled=false;uploadButton.textContent='↑ Upload to my gallery'}return toast('Could not save media: '+error.message)}$('mediaTitle').value='';$('mediaFile').value='';roMediaPreviewFile();if(uploadButton){uploadButton.disabled=false;uploadButton.textContent='↑ Upload to my gallery'}toast('Media uploaded successfully');await loadMedia()}
async function loadMedia(){if(!sb||!state.user)return;const {data,error}=await sb.from('creator_media').select('id,owner,storage_path,kind,title,mime_type,created_at').eq('owner',state.user.id).order('created_at',{ascending:false}).limit(100);const box=$('mediaLibrary');if(!box)return;if(error){box.innerHTML=`<div class="note">${esc(error.message)} — run media.sql in Supabase.</div>`;return}mediaList=data||[];roRenderMediaGallery()}
async function deleteMedia(id){const m=mediaList.find(x=>x.id===id);if(!m||!confirm('Delete this media permanently?'))return;const {error}=await sb.storage.from('creator-media').remove([m.storage_path]);if(error)return toast(error.message);const d=await sb.from('creator_media').delete().eq('id',id);if(d.error)return toast(d.error.message);toast('Media deleted');await loadMedia()}

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
