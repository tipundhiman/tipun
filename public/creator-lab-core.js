/*
 * RhymeOrbit Creator Lab · pure utilities.
 * No network, music generation, payments or account data.
 * Keep deterministic functions here so future developers can add tests safely.
 */
export const NOTES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SECONDS_IN_MINUTE=60;
const positive=(value,low,high)=>{const n=Number(value);return Number.isFinite(n)&&n>=low&&n<=high?n:null};
export function formatDuration(seconds){
 if(!Number.isFinite(seconds)||seconds<0)return '—';
 const n=Math.round(seconds);
 return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
}
export function wordCount(input){
 const text=String(input||'');
 if(globalThis.Intl?.Segmenter){
  try{return Array.from(new Intl.Segmenter(undefined,{granularity:'word'}).segment(text)).filter(x=>x.isWordLike).length}catch{}
 }
 return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[]).length;
}
export function lineCount(input){return String(input||'').split(/\r?\n/).filter(s=>s.trim()).length}
export function syllableEstimate(input){
 return String(input||'').toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)?.reduce((total,raw)=>{
  const word=raw.replace(/[^a-z]/g,'');
  if(word.length<=3)return total+1;
  let cleaned=word.replace(/(?:[^l]e|ed|es)$/,'');
  if(!cleaned)cleaned=word;
  const vowelGroups=cleaned.match(/[aeiouy]+/g)||[];
  return total+Math.max(1,vowelGroups.length);
 },0)||0;
}
const RHYME_BANK=[
 'night light bright sight might flight right tight white',
 'love above dove glove',
 'day say play way stay gray away',
 'heart start apart art smart',
 'time rhyme climb chime prime',
 'sound ground round found bound',
 'home roam foam chrome',
 'fire desire higher wire',
 'rain pain gain chain train',
 'dream stream beam team theme',
 'blue true through new grew',
 'song long strong along',
 'glow flow snow show grow',
 'dance chance glance romance',
 'more door floor shore score',
 'name flame same game fame',
 'free see be sea me',
 'high sky fly try why',
 'cold bold told gold hold',
 'end friend bend send mend'
].map(row=>row.split(' '));
export function findRhyme(input){
 const word=String(input||'').trim().toLowerCase().replace(/[^a-z]/g,'');
 if(!word)return [];
 const bank=RHYME_BANK.find(group=>group.includes(word));
 if(bank)return bank.filter(x=>x!==word);
 return [];
}
export function repeats(input){
 const map=new Map();
 for(const raw of String(input||'').split(/\r?\n/)){
  const line=raw.trim().replace(/\s+/g,' ');
  if(line.length<2)continue;
  const key=line.toLocaleLowerCase();
  const existing=map.get(key)||{line,count:0};
  existing.count++;map.set(key,existing);
 }
 return [...map.values()].filter(x=>x.count>1).sort((a,b)=>b.count-a.count).slice(0,12);
}
export function arrangement(input,bpm){
 const tempo=positive(bpm,30,240);
 if(!tempo)throw Error('Choose a tempo between 30 and 240 BPM.');
 const lines=String(input||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length<1||lines.length>30)throw Error('Add 1–30 song sections.');
 let totalBars=0;
 const sections=lines.map((line,index)=>{
  const match=/^(.{1,50}):\s*(\d{1,3})$/.exec(line);
  if(!match)throw Error('Line '+(index+1)+': use Section:bars (for example Verse:16).');
  const bars=positive(match[2],1,128);
  if(!bars)throw Error('Use 1–128 bars per section.');
  const start=(totalBars*4*SECONDS_IN_MINUTE)/tempo;
  totalBars+=bars;
  return {name:match[1],bars,start,until:totalBars*4*SECONDS_IN_MINUTE/tempo};
 });
 return {sections,bars:totalBars,seconds:totalBars*4*SECONDS_IN_MINUTE/tempo};
}
export function makeLrc(input){
 const lines=String(input||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length||lines.length>400)throw Error('Add 1–400 timestamped lyric lines.');
 let last=-1;
 return lines.map((line,index)=>{
  const match=/^(\d{1,3}):([0-5]\d)(?:\.(\d{1,2}))?\s*\|\s*(.{1,300})$/.exec(line);
  if(!match)throw Error('Line '+(index+1)+': use 00:10.50 | lyric text.');
  const cs=Number((match[3]||'0').padEnd(2,'0'));
  const time=Number(match[1])*60+Number(match[2])+cs/100;
  if(time<last)throw Error('Line '+(index+1)+': timestamps must be in order.');
  last=time;
  const stamp=String(match[1]).padStart(2,'0')+':'+match[2]+'.'+String(cs).padStart(2,'0');
  return '['+stamp+']'+match[4].trim();
 }).join('\n')+'\n';
}
export function tapBpm(times){
 const recent=times.slice(-8);
 const gaps=recent.slice(1).map((t,i)=>t-recent[i]).filter(x=>x>=180&&x<=2000);
 if(!gaps.length)return null;
 const sorted=[...gaps].sort((a,b)=>a-b);
 const mid=Math.floor(sorted.length/2);
 const median=sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
 return Math.round(60000/median);
}
export function keyTranspose(key,semitones){
 const match=/^([A-G]#?)(m?)$/.exec(String(key));
 const shift=positive(Math.abs(Number(semitones)),0,12);
 if(!match||shift===null)throw Error('Select a valid key and up to 12 semitones.');
 const index=NOTES.indexOf(match[1]);
 if(index<0)throw Error('Unknown key');
 return NOTES[((index+Number(semitones))%12+12)%12]+match[2];
}
export function scaleNotes(root,mode='major'){
 const index=NOTES.indexOf(root);
 if(index<0||!['major','minor'].includes(mode))throw Error('Choose a valid root and scale.');
 const steps=mode==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];
 return steps.map(step=>NOTES[(index+step)%12]);
}
export function chordProgression(root,mode='major'){
 const index=NOTES.indexOf(root);
 if(index<0||!['major','minor'].includes(mode))throw Error('Choose a valid chord key.');
 const offsets=mode==='major'?[0,7,9,5]:[0,8,3,10];
 const qualities=mode==='major'?['','', 'm','']:['m','','',''];
 return offsets.map((offset,i)=>NOTES[(index+offset)%12]+qualities[i]);
}
export function noteFrequency(midi){
 const note=positive(midi,0,127);
 if(note===null||!Number.isInteger(note))throw Error('MIDI note must be an integer from 0 to 127.');
 return {name:NOTES[note%12]+String(Math.floor(note/12)-1),hz:440*Math.pow(2,(note-69)/12)};
}
export function barDuration(bars,bpm){
 const count=positive(bars,1,1000),tempo=positive(bpm,30,240);
 if(count===null||tempo===null)throw Error('Use 1–1000 bars and 30–240 BPM.');
 return count*4*60/tempo;
}
export function validateSplits(input){
 const lines=String(input||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length||lines.length>30)throw Error('Enter 1–30 contributors.');
 const seen=new Set();
 const entries=lines.map((line,i)=>{
  const match=/^(.{1,80})\s*\|\s*(\d+(?:\.\d{1,2})?)$/.exec(line);
  if(!match)throw Error('Line '+(i+1)+': use Name | percent.');
  const name=match[1].trim(),percent=Number(match[2]);
  if(percent<0||percent>100)throw Error('Percent must be 0–100.');
  if(seen.has(name.toLowerCase()))throw Error('Duplicate contributor: '+name);
  seen.add(name.toLowerCase());return {name,percent};
 });
 const total=Math.round(entries.reduce((sum,e)=>sum+e.percent,0)*100)/100;
 return {entries,total,valid:total===100};
}
export function trackingUrl(url,source,campaign){
 let parsed;
 try{parsed=new URL(url)}catch{throw Error('Enter a valid https:// website URL.')}
 if(parsed.protocol!=='https:')throw Error('Use a secure https:// destination.');
 if(parsed.username||parsed.password)throw Error('Do not include passwords in URLs.');
 if(!String(source).trim()||!String(campaign).trim())throw Error('Add source and campaign.');
 parsed.searchParams.set('utm_source',String(source).trim().slice(0,80));
 parsed.searchParams.set('utm_medium','social');
 parsed.searchParams.set('utm_campaign',String(campaign).trim().slice(0,80));
 return parsed.toString();
}
export function metadataBrief({title,artist,genre,credits}){
 if(!String(title||'').trim()||!String(artist||'').trim())throw Error('Add song title and artist name.');
 return [
 'RhymeOrbit / Release metadata draft',
 'Song: '+String(title).trim().slice(0,120),
 'Artist: '+String(artist).trim().slice(0,120),
 'Language / genre: '+String(genre||'Not specified').trim().slice(0,100),
 'Credits: '+String(credits||'To confirm').trim().slice(0,500),
 'Check: ownership, ISRC/distributor rules, artwork, dates and agreements before release.'
 ].join('\n');
}
const HOOKS={
 en:['Tell a story about a small win that changed your life.','Describe someone you miss through an ordinary daily sound.','Write one line that reframes an ending as a beginning.','Make a chorus from a moment your whole city celebrated.'],
 hi:['Ek chhoti jeet se badli zindagi ki kahani likho.','Roz ki ek aawaz se kisi apne ki yaad bayan karo.','Kisi ant ko nayi shuruaat banane wali line likho.','Apne shehar ke jashn ka chorus banao.'],
 es:['Cuenta una pequeña victoria que cambió tu vida.','Describe a quien extrañas con un sonido cotidiano.','Convierte un final en el comienzo de un estribillo.','Escribe un coro sobre una celebración en tu ciudad.'],
 pt:['Conte uma pequena vitória que mudou sua vida.','Descreva alguém de quem sente falta usando um som cotidiano.','Transforme um fim no começo de um refrão.','Crie um refrão sobre a festa da sua cidade.'],
 fr:['Raconte une petite victoire qui a changé ta vie.','Évoque une personne absente par un son quotidien.','Transforme une fin en nouveau départ pour ton refrain.','Écris un refrain sur une fête dans ta ville.'],
 ur:['Ek chhoti kamyabi ki kahani par geet likhein.','Roz ki ek aawaz se kisi ki yaad bayan karein.','Judai ke baad naye safar ka misra likhein.','Apne shehar ki khushi ka chorus likhein.']
};
export function hookIdea(lang,mood){
 const index={hope:0,love:1,heartbreak:2,party:3}[mood];
 if(index===undefined)throw Error('Choose a valid mood.');
 return (HOOKS[lang]||HOOKS.en)[index];
}
