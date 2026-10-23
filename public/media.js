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
function mediaPage(){return appPage(`${heading('MEDIA STUDIO / CREATE & SHARE','Bring your sound <span class="serif">to life.</span>','Generate instrumental music, upload original photos, videos and audio, and download your work.')}<div class="grid2"><section class="panel"><span class="eyebrow">AI MUSIC GENERATOR</span><h3 style="margin-top:12px">Generate an instrumental</h3><p class="muted">Powered by Replicate MusicGen when configured. Generates music without sung vocals. Provider charges may apply.</p><form onsubmit="createMusic(event)"><div class="field"><label for="musicPrompt">Describe your sound</label><textarea id="musicPrompt" minlength="10" maxlength="1000" required style="min-height:130px" placeholder="A dreamy synth-pop instrumental with airy pads, a warm bassline and uplifting drums..."></textarea></div><div class="field"><label for="musicDuration">Duration</label><select id="musicDuration"><option value="8">8 seconds</option><option value="15" selected>15 seconds</option><option value="30">30 seconds</option></select></div><button class="btn gold" type="submit">✧ Generate music</button></form><div id="musicResult" style="margin-top:20px"><div class="note">Sign in and configure the music API token to generate audio. Song lyrics and shayari are in AI Studio.</div></div></section><section class="panel"><span class="eyebrow">CREATOR PORTFOLIO</span><h3 style="margin-top:12px">Upload your work</h3><p class="muted">Upload your own images, videos or audio. Public portfolio media is visible to other creators. Maximum file size 50 MB.</p><form onsubmit="uploadMedia(event)"><div class="field"><label for="mediaTitle">Title</label><input id="mediaTitle" maxlength="140" required placeholder="My latest artwork or music"></div><div class="field"><label for="mediaFile">Select photo, video or audio</label><input id="mediaFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg" required></div><button class="btn gold" type="submit">↑ Upload media</button></form><div class="note" style="margin-top:16px">Upload only content you own or are authorized to publish. Never upload private documents.</div></section></div><section style="margin-top:25px"><div class="section-header"><div><div class="eyebrow">YOUR CREATIONS</div><h2 class="section-title">Your media <span class="serif">library.</span></h2></div><button class="btn" onclick="loadMedia()">↻ Refresh</button></div><div id="mediaLibrary" class="grid3"><div class="empty">Loading media…</div></div></section><section class="panel" style="margin-top:24px"><h2>♫ My Generated Songs</h2><p class="muted small">Songs generated or recovered in AI Studio on this browser. No extra credits to play an existing song.</p><div id="roMediaGeneratedSongs"></div></section>`)}
async function authToken(){if(!sb)return null;return (await sb.auth.getSession()).data.session?.access_token||null}
async function createMusic(e){e.preventDefault();const token=await authToken();if(!token)return toast('Please sign in first');const el=$('musicResult');el.innerHTML='<div class="note loading">Submitting music generation…</div>';try{const r=await fetch('/api/music/generate',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({prompt:$('musicPrompt').value.trim(),duration:Number($('musicDuration').value)})});const j=await r.json();if(!r.ok)throw Error(j.error||'Could not start generation');musicJob=j.id;showMusicStatus(j);if(musicTimer)clearInterval(musicTimer);musicTimer=setInterval(checkMusic,4500)}catch(err){el.innerHTML=`<div class="note">${esc(err.message)}</div>`}}
async function checkMusic(){if(!musicJob)return;const token=await authToken();if(!token)return;try{const r=await fetch('/api/music/prediction/'+encodeURIComponent(musicJob),{headers:{Authorization:'Bearer '+token}});const j=await r.json();if(!r.ok)throw Error(j.error||'Could not check status');showMusicStatus(j);if(['succeeded','failed','canceled'].includes(j.status)){clearInterval(musicTimer);musicTimer=null}}catch(e){clearInterval(musicTimer);musicTimer=null;$('musicResult').textContent=e.message}}
function showMusicStatus(j){const el=$('musicResult');if(!el)return;const url=Array.isArray(j.output)?j.output[0]:typeof j.output==='string'?j.output:null;const safe=url&&/^https:\/\//.test(url)?url:null;el.innerHTML=`<div class="note"><b>Status: ${esc(j.status||'starting')}</b>${j.error?`<p>${esc(j.error)}</p>`:''}${j.status==='succeeded'&&safe?`<div style="margin-top:15px"><audio controls preload="none" src="${esc(safe)}" style="width:100%"></audio><p><a class="btn gold" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">↓ Open / save generated audio</a></p><p class="muted small">If the provider opens audio in a new tab, use your browser’s Save audio option. Provider links may expire.</p></div>`:''}</div>`}
async function uploadMedia(e){e.preventDefault();if(!sb||!state.user)return toast('Please sign in');const f=$('mediaFile').files?.[0],title=$('mediaTitle').value.trim();if(!f||!title)return toast('Choose a file and title');const kind=mediaKind(f),allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/wav','audio/ogg'];if(!kind||!allowed.includes(f.type)||f.size>50*1024*1024)return toast('Unsupported format or file larger than 50 MB');const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/wav':'wav','audio/ogg':'ogg'})[f.type];const path=state.user.id+'/'+crypto.randomUUID()+'.'+ext;toast('Uploading media…');const uploaded=await sb.storage.from('creator-media').upload(path,f,{contentType:f.type,upsert:false});if(uploaded.error)return toast('Upload failed: '+uploaded.error.message);const {error}=await sb.from('creator_media').insert({owner:state.user.id,storage_path:path,title,kind,mime_type:f.type,size_bytes:f.size});if(error){await sb.storage.from('creator-media').remove([path]);return toast('Could not save media: '+error.message)}$('mediaTitle').value='';$('mediaFile').value='';toast('Media uploaded successfully');await loadMedia()}
async function loadMedia(){if(!sb||!state.user)return;const {data,error}=await sb.from('creator_media').select('id,owner,storage_path,kind,title,mime_type,created_at').eq('owner',state.user.id).order('created_at',{ascending:false}).limit(100);const box=$('mediaLibrary');if(!box)return;if(error){box.innerHTML=`<div class="note">${esc(error.message)} — run media.sql in Supabase.</div>`;return}mediaList=data||[];box.innerHTML=mediaList.length?mediaList.map(m=>{const url=sb.storage.from('creator-media').getPublicUrl(m.storage_path).data.publicUrl;return `<article class="panel tile">${m.kind==='image'?`<img loading="lazy" alt="${esc(m.title)}" src="${esc(url)}" style="width:100%;height:190px;object-fit:cover;border-radius:12px">`:m.kind==='video'?`<video controls preload="metadata" src="${esc(url)}" style="width:100%;height:190px;border-radius:12px"></video>`:`<div class="art"><span class="articon">♫</span></div><audio controls preload="none" src="${esc(url)}" style="width:100%"></audio>`}<h3 style="margin:12px 0">${esc(m.title)}</h3><span class="badge">${esc(m.kind)}</span><div class="card-actions"><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open / download ↗</a><button class="btn sm" onclick="deleteMedia('${m.id}')">Delete</button></div></article>`}).join(''):'<div class="empty" style="grid-column:1/-1">No media uploaded yet. Your creations will appear here.</div>'}
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


function roMediaSongList(){
 const root=document.getElementById('roMediaGeneratedSongs');if(!root)return;
 root.replaceChildren();
 const key='ro_treblo_library_'+(state.user?.id||'guest');
 let items=[];try{items=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
 if(!items.length){root.textContent='No generated songs saved on this browser yet. Recover your task ID in AI Studio first.';return}
 for(const song of items){
  const card=document.createElement('div');card.style.cssText='padding:14px 0;border-bottom:1px solid #444';
  const title=document.createElement('strong');title.textContent=song.title||'My AI Song';
  const meta=document.createElement('div');meta.className='muted small';meta.textContent='Treblo · '+(song.status||'Saved');
  const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.style.cssText='display:block;width:100%;margin:10px 0';if(song.url)audio.src=song.url;
  const btn=document.createElement('button');btn.className='btn sm';btn.textContent='↻ Refresh audio / Play';btn.onclick=async()=>{
    try{
      const token=await authToken();if(!token)throw Error('Please log in first');
      btn.disabled=true;btn.textContent='Loading existing song…';
      const response=await fetch('/api/music/prediction/'+encodeURIComponent(song.id),{headers:{Authorization:'Bearer '+token}});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Could not load song');
      if(result.status==='succeeded'&&result.output){audio.src=result.output;audio.load();await audio.play().catch(()=>{});song.url=result.output;localStorage.setItem(key,JSON.stringify(items))}
      else toast('Song status: '+result.status);
    }catch(err){toast(err.message||'Unable to load song')}finally{btn.disabled=false;btn.textContent='↻ Refresh audio / Play'}
  };
  card.append(title,meta,audio,btn);root.append(card);
 }
}
const roOriginalMediaRender=render;
render=function(){roOriginalMediaRender();if(state.page==='media')roMediaSongList()};
window.addEventListener('hashchange',()=>{const target=location.hash.slice(1);if(target==='media'&&state.page!=='media')go('media');else if(target&&target!==state.page&&['home','studio','projects','listen','discover','community','profile','help'].includes(target))go(target)});

const roBaseMediaCloudList=roMediaSongList;
roMediaSongList=function(){
  roBaseMediaCloudList();
  if(!state.user||!sb)return;
  authToken().then(async token=>{
    if(!token)return;
    const response=await fetch('/api/music/library',{headers:{Authorization:'Bearer '+token}});
    if(!response.ok)return;
    const data=await response.json();
    const key='ro_treblo_library_'+state.user.id;
    let local=[];try{local=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
    let changed=false;
    for(const song of data.items||[]){
      const index=local.findIndex(x=>x.id===song.id);
      if(index<0){local.push(song);changed=true}
      else if(song.url&&local[index].url!==song.url){local[index]={...local[index],...song};changed=true}
    }
    if(changed){localStorage.setItem(key,JSON.stringify(local));roBaseMediaCloudList()}
  }).catch(()=>{});
};
