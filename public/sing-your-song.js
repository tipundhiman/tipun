import {SONGS,durationOf,midiToHz,hzToMidi,targetAt,lineAt,pitchDistance,detectPitch,summarizePerformance} from './sing-your-song-core.js';

const $ = id => document.getElementById(id);
const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const noteName = midi => !Number.isFinite(midi) ? '—' : names[((Math.round(midi)%12)+12)%12] + (Math.floor(Math.round(midi)/12)-1);
const clock = seconds => Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
const safeStatus = (id,value) => {$(id).textContent=value;};
const DB = 'rhymeorbit-sing-performances-v1';
let selected = SONGS[0];
let chosenNote = 60;
let running = null;
let downloadUrl = null;
let historyUrls = [];

function view(name) {
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-selected',String(button.dataset.view===name));
  for (const tab of ['songs','coach','history']) $('ss'+tab[0].toUpperCase()+tab.slice(1)).hidden=tab!==name;
  if (name==='history') renderHistory();
  try {history.replaceState(null,'','#'+name);} catch {}
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{if(running)stopSession();view(button.dataset.view);}));
if (['#songs','#coach','#history'].includes(location.hash)) view(location.hash.slice(1));

function chooseSong(song) {
  if (running) stopSession();
  selected=song;
  document.querySelectorAll('.track').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.id===song.id)));
  safeStatus('ssSongTitle',song.title+' · '+song.subtitle);
  safeStatus('ssDuration',clock(durationOf(song)));
  $('ssResult').hidden=true;
  progressSong(0);
  safeStatus('ssStatus','Ready: '+song.title+'. Tap Listen first or Start singing.');
}
function progressSong(seconds) {
  const song=selected;
  const elapsed=Math.min(durationOf(song),Math.max(0,seconds));
  const line=lineAt(song,elapsed);
  safeStatus('ssLineLabel',seconds<=0?'READY WHEN YOU ARE':`LINE ${line+1} / ${song.lyrics.length}`);
  safeStatus('ssCurrentLine',song.lyrics[line]);
  safeStatus('ssNextLine',song.lyrics[line+1]||'🎶 Sing it from your heart');
  safeStatus('ssTime',clock(elapsed));
  const percentage=Math.round(elapsed/durationOf(song)*100);
  $('ssProgressFill').style.width=percentage+'%';
  $('ssProgress').setAttribute('aria-valuenow',String(percentage));
  safeStatus('ssTarget',noteName(targetAt(song,elapsed)));
}
const list=$('ssSongList');
for(const song of SONGS){
  const button=document.createElement('button');button.type='button';button.className='track';button.dataset.id=song.id;
  button.setAttribute('aria-pressed',String(song===selected));
  const emoji=document.createElement('span');emoji.className='emoji';emoji.textContent=song.emoji;
  const strong=document.createElement('strong');strong.textContent=song.title;
  const label=document.createElement('span');label.textContent=song.subtitle+' · '+clock(durationOf(song));
  button.append(emoji,strong,label);button.addEventListener('click',()=>chooseSong(song));list.append(button);
}
progressSong(0);

/* Warm, original instrumental accompaniment. Generated in the browser; no API credits. */
function tone(ctx,output,freq,start,seconds,volume,type='sine') {
  const oscillator=ctx.createOscillator(), gain=ctx.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(freq,start);
  const attack=Math.min(.055,seconds/3), release=Math.max(.07,seconds*.7);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.linearRampToValueAtTime(Math.max(.0002,volume),start+attack);
  gain.gain.exponentialRampToValueAtTime(.0001,start+Math.max(attack+.04,seconds-release));
  oscillator.connect(gain).connect(output);
  oscillator.start(start);oscillator.stop(start+seconds);
}
function softPercussion(ctx,output,start,snare=false) {
  const oscillator=ctx.createOscillator(),envelope=ctx.createGain();
  oscillator.type='triangle';oscillator.frequency.setValueAtTime(snare?200:95,start);
  oscillator.frequency.exponentialRampToValueAtTime(snare?85:45,start+.10);
  envelope.gain.setValueAtTime(.045,start);envelope.gain.exponentialRampToValueAtTime(.0001,start+.13);
  oscillator.connect(envelope).connect(output);oscillator.start(start);oscillator.stop(start+.14);
}
function beginInstrumental(ctx,output,song,withGuide=true) {
  const beatSeconds=60/song.bpm;
  const anchor=ctx.currentTime+.09;
  let nextBeat=0;
  let closed=false;
  function schedule() {
    if(closed)return;
    while(nextBeat<song.bars*4 && anchor+nextBeat*beatSeconds<ctx.currentTime+.32) {
      const start=anchor+nextBeat*beatSeconds,bar=Math.floor(nextBeat/4),sub=nextBeat%4;
      const chord=song.chords[bar%song.chords.length];
      if(sub===0){
        chord.forEach((freq,index)=>tone(ctx,output,freq,start,beatSeconds*3.86,index? .019:.026,'sine'));
        tone(ctx,output,chord[0]/2,start,beatSeconds*1.6,.052,'triangle');
      }
      if(sub===2)tone(ctx,output,chord[0]/2,start,beatSeconds*.9,.031,'triangle');
      if(sub===0||sub===2)softPercussion(ctx,output,start,false);
      if(sub===1||sub===3)softPercussion(ctx,output,start,true);
      if(withGuide)tone(ctx,output,midiToHz(song.notes[nextBeat%song.notes.length]),start,beatSeconds*.82,.034,'sine');
      nextBeat++;
    }
  }
  schedule();
  const interval=setInterval(schedule,95);
  return {origin:anchor,stop(){closed=true;clearInterval(interval);}};
}

function mimeType(){
  if (!window.MediaRecorder)return null;
  return ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type))||null;
}
function listen() {startSong(false);}
async function sing() {await startSong(true);}
async function startSong(record) {
  if(running)stopSession();
  if(!window.AudioContext){safeStatus('ssStatus','This browser does not support Web Audio. Try updated Chrome, Edge or Safari.');return;}
  if(record && (!navigator.mediaDevices?.getUserMedia||!mimeType())){
    safeStatus('ssStatus','Microphone/recording unavailable. Use HTTPS and a recent browser.');return;
  }
  $('ssStart').disabled=true;$('ssListen').disabled=true;$('ssStop').disabled=false;
  $('ssResult').hidden=true;
  safeStatus('ssStatus',record?'Requesting microphone permission…':'Starting instrumental preview…');
  let ctx,mic;
  try {
    if(record) mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}});
    ctx=new AudioContext();await ctx.resume();
    const master=ctx.createGain();master.gain.value=.66;
    master.connect(ctx.destination);
    const sink=record?ctx.createMediaStreamDestination():null;
    if(sink)master.connect(sink);
    const backing=beginInstrumental(ctx,master,selected,$('ssMelodyGuide').checked);
    const session={type:'song',ctx,mic,backing,record,selected,started:backing.origin,samples:[],recorder:null,interval:null,sink};
    running=session;
    if(mic){
      const source=ctx.createMediaStreamSource(mic),analyser=ctx.createAnalyser();
      analyser.fftSize=2048;
      source.connect(analyser);
      const micGain=ctx.createGain();micGain.gain.value=.96;
      source.connect(micGain).connect(sink);
      session.analyser=analyser;
      session.buffer=new Float32Array(analyser.fftSize);
      const chunks=[];
      const type=mimeType();
      const recorder=new MediaRecorder(sink.stream,{mimeType:type,audioBitsPerSecond:128000});
      session.recorder=recorder;
      recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
      recorder.onstop=()=>finishRecording(session,chunks,type);
      recorder.start(1000);
    }
    safeStatus('ssStatus',record?'🔴 Recording your voice with original backing. Wear headphones.':'♫ Playing instrumental. Tap Finish any time.');
    session.interval=setInterval(()=>updateSong(session),145);
  }catch(error){
    mic?.getTracks().forEach(track=>track.stop());
    await ctx?.close().catch(()=>{});
    if(running?.ctx===ctx)running=null;
    $('ssStart').disabled=false;$('ssListen').disabled=false;$('ssStop').disabled=true;
    safeStatus('ssStatus','Could not start: '+(error.message||'Microphone permission denied.'));
  }
}
function updateSong(session){
  if(running!==session)return;
  const seconds=Math.max(0,session.ctx.currentTime-session.started);
  progressSong(seconds);
  if(session.analyser){
    session.analyser.getFloatTimeDomainData(session.buffer);
    const freq=detectPitch(session.buffer,session.ctx.sampleRate);
    if(freq){
      const heard=hzToMidi(freq);
      safeStatus('ssDetected',noteName(heard));
      session.samples.push({at:seconds,error:pitchDistance(heard,targetAt(session.selected,seconds))});
    }else safeStatus('ssDetected','—');
  }
  if(seconds>=durationOf(session.selected)) stopSession();
}
function stopSession() {
  const session=running;if(!session)return;
  running=null;
  clearInterval(session.interval);
  session.backing?.stop();
  session.mic?.getTracks().forEach(track=>track.stop());
  if(session.recorder?.state==='recording')session.recorder.stop();
  session.ctx.close().catch(()=>{});
  $('ssStart').disabled=false;$('ssListen').disabled=false;$('ssStop').disabled=true;
  $('ssCoachStart').disabled=false;$('ssCoachStop').disabled=true;
  if(session.type==='song'){
    const report=summarizePerformance(session.samples);
    if(session.record){
      $('ssResult').hidden=false;
      safeStatus('ssScore',report.score===null?'Practice complete':report.score+'% pitch match*');
      safeStatus('ssFeedback',report.tip);
      safeStatus('ssStatus','✓ Performance finished. Preparing recording and saving it in this browser…');
    }else safeStatus('ssStatus','Preview finished. Ready when you are.');
  }else{
    const report=summarizePerformance(session.samples);
    $('ssCoachResult').hidden=false;
    safeStatus('ssCoachScore',report.score===null?'Keep practising':report.score+'% pitch match*');
    safeStatus('ssCoachFeedback',report.tip);
    safeStatus('ssCoachStatus','✓ Exercise finished. Try another note, or sing one of the karaoke songs.');
  }
}
async function finishRecording(session,chunks,type){
  if(!chunks.length){safeStatus('ssStatus','No recording captured. Please check microphone permissions.');return;}
  const blob=new Blob(chunks,{type});
  const ext=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm';
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);
  downloadUrl=URL.createObjectURL(blob);
  $('ssDownload').href=downloadUrl;
  $('ssDownload').download='rhymeorbit-'+session.selected.id+'-'+Date.now()+'.'+ext;
  $('ssDownload').hidden=false;
  const item={id:Date.now()+'-'+Math.random().toString(36).slice(2,8),song:session.selected.title,createdAt:Date.now(),blob,ext,score:summarizePerformance(session.samples).score};
  try{await saveToBrowser(item);safeStatus('ssStatus','✓ Recording ready! Saved to My Recordings in this browser. Download a copy to keep safely.');}
  catch {safeStatus('ssStatus','✓ Recording ready for download. Browser storage unavailable, so download it now.');}
}
$('ssListen').addEventListener('click',listen);
$('ssStart').addEventListener('click',sing);
$('ssStop').addEventListener('click',stopSession);
$('ssViewHistory').addEventListener('click',()=>view('history'));

function showNote(midi){chosenNote=midi;safeStatus('ssCoachTarget',noteName(midi));
  document.querySelectorAll('#ssCoachNotes button').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.midi)===midi)));
}
document.querySelectorAll('#ssCoachNotes button').forEach(button=>button.addEventListener('click',()=>showNote(Number(button.dataset.midi))));
$('ssHearNote').addEventListener('click',async()=>{
  if(!window.AudioContext)return;
  const ctx=new AudioContext();await ctx.resume();
  tone(ctx,ctx.destination,midiToHz(chosenNote),ctx.currentTime+.05,1.65,.18,'sine');
  setTimeout(()=>ctx.close().catch(()=>{}),2000);
});
async function startCoach(){
  if(running)stopSession();
  if(!navigator.mediaDevices?.getUserMedia||!window.AudioContext){safeStatus('ssCoachStatus','A microphone and HTTPS are needed for this lesson.');return;}
  $('ssCoachStart').disabled=true;$('ssCoachStop').disabled=false;
  $('ssCoachResult').hidden=true;
  safeStatus('ssCoachStatus','Requesting microphone permission…');
  let mic,ctx;
  try {
    mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}});
    ctx=new AudioContext();await ctx.resume();
    const analyser=ctx.createAnalyser();analyser.fftSize=2048;
    ctx.createMediaStreamSource(mic).connect(analyser);
    const session={type:'coach',ctx,mic,selected,started:ctx.currentTime,samples:[],analyser,buffer:new Float32Array(analyser.fftSize),target:chosenNote};
    running=session;
    session.interval=setInterval(()=>{
      if(running!==session)return;
      const elapsed=ctx.currentTime-session.started;
      analyser.getFloatTimeDomainData(session.buffer);
      const freq=detectPitch(session.buffer,ctx.sampleRate);
      if(freq){const heard=hzToMidi(freq);const delta=heard-session.target;
        session.samples.push({at:elapsed,error:pitchDistance(heard,session.target)});
        safeStatus('ssCoachDetected',noteName(heard));
        $('ssNeedle').style.left=Math.max(3,Math.min(97,50+delta*13))+'%';
      }else safeStatus('ssCoachDetected','—');
      if(elapsed>=10)stopSession();
      else safeStatus('ssCoachStatus','🎙 Singing… '+Math.ceil(10-elapsed)+' seconds left. Hold '+noteName(session.target)+' gently.');
    },150);
  }catch(error){
    mic?.getTracks().forEach(track=>track.stop());await ctx?.close().catch(()=>{});
    $('ssCoachStart').disabled=false;$('ssCoachStop').disabled=true;
    safeStatus('ssCoachStatus','Microphone unavailable: '+(error.message||'permission blocked'));
  }
}
$('ssCoachStart').addEventListener('click',startCoach);
$('ssCoachStop').addEventListener('click',stopSession);

function openDb(){return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(Error('Browser storage unsupported'));return;}
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('recordings'))request.result.createObjectStore('recordings',{keyPath:'id'});};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});}
function dbRequest(mode,run){return openDb().then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction('recordings',mode),store=tx.objectStore('recordings');
  let response;
  try{response=run(store);}catch(error){db.close();reject(error);return;}
  tx.oncomplete=()=>{db.close();resolve(response?.result);};
  tx.onerror=()=>{db.close();reject(tx.error);};
  tx.onabort=()=>{db.close();reject(tx.error);};
}));}
async function saveToBrowser(item){await dbRequest('readwrite',store=>store.put(item));
  // Keep a small local collection: audio recordings never reach R2.
  const items=await dbRequest('readonly',store=>store.getAll());
  const old=items.sort((a,b)=>b.createdAt-a.createdAt).slice(5);
  for(const entry of old)await dbRequest('readwrite',store=>store.delete(entry.id));
}
async function renderHistory(){
  const container=$('ssHistoryList');container.replaceChildren();
  historyUrls.forEach(url=>URL.revokeObjectURL(url));historyUrls=[];
  let entries;
  try{entries=await dbRequest('readonly',store=>store.getAll());}
  catch {container.textContent='Browser storage unavailable. Recordings can still be downloaded after singing.';return;}
  entries.sort((a,b)=>b.createdAt-a.createdAt);
  if(!entries.length){container.textContent='No recordings yet. Open Sing Karaoke and record your first performance!';return;}
  for(const entry of entries){
    const card=document.createElement('div');card.className='history-item';
    const header=document.createElement('div');header.className='row';
    const title=document.createElement('strong');title.textContent=entry.song;
    const subtitle=document.createElement('span');subtitle.className='muted';subtitle.textContent=new Date(entry.createdAt).toLocaleString()+(Number.isFinite(entry.score)?' · '+entry.score+'% practice match':'');
    header.append(title,subtitle);
    const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';
    const url=URL.createObjectURL(entry.blob);historyUrls.push(url);audio.src=url;
    const controls=document.createElement('div');controls.className='row';
    const download=document.createElement('a');download.className='btn primary';download.textContent='↓ Download';download.href=url;download.download='rhymeorbit-'+entry.id+'.'+entry.ext;
    const del=document.createElement('button');del.type='button';del.className='btn';del.textContent='Delete from this browser';
    del.onclick=async()=>{if(!confirm('Delete this local recording? This cannot be undone.'))return;
      try{await dbRequest('readwrite',store=>store.delete(entry.id));await renderHistory();}
      catch{alert('Could not delete this recording.');}
    };
    controls.append(download,del);card.append(header,audio,controls);container.append(card);
  }
}
window.addEventListener('pagehide',()=>{
  if(running)stopSession();
  historyUrls.forEach(url=>URL.revokeObjectURL(url));
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);
});
