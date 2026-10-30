import {
 NOTES,formatDuration,wordCount,lineCount,syllableEstimate,findRhyme,repeats,
 arrangement,makeLrc,tapBpm,keyTranspose,scaleNotes,chordProgression,noteFrequency,
 barDuration,validateSplits,trackingUrl,metadataBrief,hookIdea
} from './creator-lab-core.js?v=20261031-1';

/* RhymeOrbit Creator Lab: user-initiated browser tools. No API tokens and no uploads. */
const byId=id=>document.getElementById(id);
const value=id=>(byId(id)?.value||'').trim();
const show=(id,message)=>{const out=byId(id);if(out)out.textContent=message};
const inform=message=>{show('clStatus',message);if(message)byId('clStatus').scrollIntoView({behavior:'smooth',block:'nearest'})};
const invoke=(out,fn)=>{
 try{const result=fn();if(result!==undefined)show(out,result)}
 catch(error){show(out,error instanceof Error?error.message:'This action could not finish.')}
};
const number=(id,min,max)=>{
 const num=Number(value(id));
 if(!Number.isFinite(num)||num<min||num>max)throw Error('Enter a number between '+min+' and '+max+'.');
 return num;
};
const releaseText=(name,text,type='text/plain;charset=utf-8')=>{
 const blob=new Blob([text],{type});
 const link=document.createElement('a');
 const url=URL.createObjectURL(blob);
 link.href=url;link.download=name;link.style.display='none';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
};
const DRAFT_KEY='ro_creator_lab_lyrics_v1',CHECK_KEY='ro_creator_lab_release_v1';
try{byId('clLyrics').value=localStorage.getItem(DRAFT_KEY)||''}catch{}
function words(){
 const text=value('clLyrics');
 const words=wordCount(text);
 show('clWordsOut',words+' words · '+Array.from(text).length+' characters · '+lineCount(text)+' non-empty lines');
 try{if(text.length<=50000)localStorage.setItem(DRAFT_KEY,text)}catch{}
}
byId('clLyrics').addEventListener('input',words);
words();
for(const name of ['clKey','clScaleRoot','clChordRoot']){
 const select=byId(name);
 for(const note of NOTES){const option=document.createElement('option');option.value=note;option.textContent=note;select.append(option)}
}
const keySelect=byId('clKey');
for(const note of NOTES){const option=document.createElement('option');option.value=note+'m';option.textContent=note+' minor';keySelect.append(option)}
byId('clScaleRoot').value='C';byId('clChordRoot').value='C';byId('clKey').value='C';
let taps=[];
let context=null,metroId=null,metroCount=0,playing=false;
function audioContext(){
 if(!context)context=new (window.AudioContext||window.webkitAudioContext)();
 if(context.state==='suspended')context.resume();
 return context;
}
function playClick(){
 const ctx=audioContext(),osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime;
 osc.type='sine';osc.frequency.value=metroCount++%4===0?1040:720;
 gain.gain.setValueAtTime(.0001,t);
 gain.gain.exponentialRampToValueAtTime(.18,t+.006);
 gain.gain.exponentialRampToValueAtTime(.0001,t+.065);
 osc.connect(gain);gain.connect(ctx.destination);
 osc.start(t);osc.stop(t+.075);
}
function stopMetronome(){
 if(metroId){clearInterval(metroId);metroId=null}
 playing=false;byId('clMetro').textContent='Start metronome';show('clMetroOut','Stopped.');
}
let recorder=null,stream=null,chunks=[],voiceUrl=null,voiceLimit=null;
function cleanupMic(){
 if(stream){for(const track of stream.getTracks())track.stop();stream=null}
 if(voiceLimit){clearTimeout(voiceLimit);voiceLimit=null}
 byId('clRecStart').disabled=false;byId('clRecStop').disabled=true;
}
async function startRecording(){
 if(recorder?.state==='recording')return;
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
  show('clVoiceOut','This browser does not support audio recording. Use Chrome or a compatible browser over HTTPS.');return;
 }
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  const types=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'];
  const type=types.find(x=>MediaRecorder.isTypeSupported(x))||'';
  recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);
  chunks=[];
  const audio=byId('clVoiceAudio'),save=byId('clVoiceDownload');
  if(voiceUrl){URL.revokeObjectURL(voiceUrl);voiceUrl=null}
  audio.hidden=true;save.hidden=true;
  recorder.addEventListener('dataavailable',event=>{if(event.data?.size)chunks.push(event.data)});
  recorder.addEventListener('stop',()=>{
   const mime=recorder?.mimeType||type||'audio/webm';
   if(chunks.length){
    const blob=new Blob(chunks,{type:mime});
    voiceUrl=URL.createObjectURL(blob);
    audio.src=voiceUrl;audio.hidden=false;
    save.href=voiceUrl;
    save.download='rhymeorbit-voice-memo.'+(mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':'webm');
    save.hidden=false;
    show('clVoiceOut','Recording saved in this tab. Play or download it before leaving.');
   }else show('clVoiceOut','No audio was recorded.');
   cleanupMic();
  },{once:true});
  recorder.addEventListener('error',()=>{show('clVoiceOut','Recording failed; try again.');cleanupMic()});
  recorder.start(250);
  byId('clRecStart').disabled=true;byId('clRecStop').disabled=false;
  show('clVoiceOut','Recording now… Maximum 30 seconds. Nothing is uploaded.');
  voiceLimit=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},30000);
 }catch(error){
  cleanupMic();show('clVoiceOut','Microphone unavailable or permission denied. Enable microphone for this page in browser settings.');
 }
}
function stopRecording(){if(recorder?.state==='recording')recorder.stop()}
const checklist=Array.from(byId('clChecklist').querySelectorAll('input[type=checkbox]'));
try{
 const selected=JSON.parse(localStorage.getItem(CHECK_KEY)||'[]');
 if(Array.isArray(selected))for(const box of checklist)box.checked=selected.includes(box.value);
}catch{}
function updateChecklist(){
 const marked=checklist.filter(x=>x.checked).map(x=>x.value);
 show('clChecklistOut',marked.length+' of '+checklist.length+' complete'+(marked.length===checklist.length?' — ready for your own release review.':'.'));
 try{localStorage.setItem(CHECK_KEY,JSON.stringify(marked))}catch{}
}
checklist.forEach(c=>c.addEventListener('change',updateChecklist));updateChecklist();
const actions={
 hook:()=>invoke('clHookOut',()=>hookIdea(value('clHookLanguage'),value('clHookMood'))),
 structure:()=>invoke('clStructureOut',()=>{
  const plan=arrangement(value('clStructure'),number('clStructureBpm',30,240));
  return plan.sections.map(x=>x.name+' · '+x.bars+' bars · '+formatDuration(x.start)+'–'+formatDuration(x.until)).join('\n')+
   '\nTotal: '+plan.bars+' bars · '+formatDuration(plan.seconds)+' at '+value('clStructureBpm')+' BPM (4/4).';
 }),
 rhyme:()=>invoke('clRhymeOut',()=>{
  const matches=findRhyme(value('clRhymeWord'));
  return matches.length?matches.join(' · '):'No pocket found in the built-in English word bank. Try night, love, dream, time or fire.';
 }),
 syllables:()=>invoke('clSyllableOut',()=>{
  const lines=value('clLyrics').split(/\r?\n/).filter(x=>x.trim());
  if(!lines.length)return 'Enter some lyrics in the Lyric draft box (tool 04).';
  return lines.slice(0,45).map(x=>syllableEstimate(x)+' ≈ '+x.slice(0,90)).join('\n')+(lines.length>45?'\nShowing first 45 lines.':'')+'\nEstimates apply only to English.';
 }),
 repeat:()=>invoke('clRepeatOut',()=>{
  const lines=repeats(value('clLyrics'));
  return lines.length?lines.map(x=>x.count+'× '+x.line).join('\n'):'No repeated lines found. Enter your draft in tool 04.';
 }),
 reading:()=>invoke('clReadingOut',()=>{
  const count=wordCount(value('clLyrics'));
  const wpm=number('clWpm',60,250);
  return count?'About '+formatDuration(count*60/wpm)+' for '+count+' spoken words. Singing and pauses will change timing.':'Enter your lyrics in tool 04 first.';
 }),
 lrc:()=>invoke('clLrcOut',()=>{
  const lrc=makeLrc(value('clLrc'));releaseText('rhymeorbit-lyrics.lrc',lrc);
  return 'Exported '+lrc.split('\n').filter(Boolean).length+' timestamped lyric lines.';
 }),
 tap:()=>{
  const now=performance.now();
  if(taps.length&&now-taps.at(-1)>3000)taps=[];
  taps.push(now);
  const bpm=tapBpm(taps);
  show('clTapOut',bpm?bpm+' BPM estimated · '+taps.length+' taps':'Keep tapping evenly…');
 },
 'tap-reset':()=>{taps=[];show('clTapOut','Start tapping...')},
 metro:()=>{
  if(playing){stopMetronome();return}
  const bpm=number('clBpm',30,240);
  if(!window.AudioContext&&!window.webkitAudioContext)throw Error('Web Audio is unavailable.');
  playing=true;metroCount=0;playClick();
  metroId=setInterval(playClick,60000/bpm);
  byId('clMetro').textContent='Stop metronome';
  show('clMetroOut',bpm+' BPM · 4/4 click playing. Change tempo by stopping and restarting.');
 },
 transpose:()=>invoke('clTransposeOut',()=>value('clKey')+' → '+keyTranspose(value('clKey'),number('clTranspose',-12,12))),
 scale:()=>invoke('clScaleOut',()=>value('clScaleRoot')+' '+value('clScaleMode')+' scale: '+scaleNotes(value('clScaleRoot'),value('clScaleMode')).join(' · ')+' (sharp notation/enharmonic equivalent possible)'),
 chords:()=>invoke('clChordOut',()=>chordProgression(value('clChordRoot'),value('clChordMode')).join('  →  ')+' · '+value('clChordMode')+' progression'),
 frequency:()=>invoke('clFreqOut',()=>{
  const note=noteFrequency(number('clMidi',0,127));
  return note.name+' ≈ '+note.hz.toFixed(2)+' Hz (A4 = 440 Hz).';
 }),
 bars:()=>invoke('clBarsOut',()=>number('clBars',1,1000)+' bars at '+value('clBarsBpm')+' BPM ≈ '+formatDuration(barDuration(number('clBars',1,1000),number('clBarsBpm',30,240)))+' (4/4).'),
 'record-start':()=>startRecording(),
 'record-stop':()=>stopRecording(),
 metadata:()=>invoke('clMetadataOut',()=>metadataBrief({title:value('clSongTitle'),artist:value('clArtist'),genre:value('clGenre'),credits:value('clCredits')})),
 split:()=>invoke('clSplitOut',()=>{
  const result=validateSplits(value('clSplit'));
  return result.entries.map(x=>x.name+' — '+x.percent+'%').join('\n')+'\nTOTAL: '+result.total+'% · '+(result.valid?'Balanced at 100%. Obtain signed agreement separately.':'NOT BALANCED: adjust percentages to total 100%.');
 }),
 utm:()=>invoke('clUtmOut',()=>trackingUrl(value('clUrl'),value('clSource'),value('clCampaign'))),
 'checklist-reset':()=>{checklist.forEach(x=>x.checked=false);updateChecklist()}
};
document.addEventListener('click',async event=>{
 const copy=event.target.closest('[data-copy]');
 if(copy){
  const text=byId(copy.dataset.copy)?.textContent||'';
  if(!text.trim()){inform('Create the result first, then copy.');return}
  try{
   await navigator.clipboard.writeText(text);inform('Copied to clipboard.');
  }catch{inform('Copy unavailable; select the result text manually.')}
  return;
 }
 const button=event.target.closest('[data-action]');
 if(!button)return;
 const fn=actions[button.dataset.action];if(!fn)return;
 try{await fn()}catch(error){inform(error instanceof Error?error.message:'Unable to complete.')}
});
byId('clBpm').addEventListener('change',()=>{if(playing)stopMetronome()});
window.addEventListener('pagehide',()=>{
 stopMetronome();if(recorder?.state==='recording')recorder.stop();cleanupMic();
 if(context)context.close();
 if(voiceUrl)URL.revokeObjectURL(voiceUrl);
});
