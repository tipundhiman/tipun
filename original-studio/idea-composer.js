/* RhymeOrbit Original Studio: deterministic text-to-arrangement engine.
 * No model, network, inference API, or AI service used.
 * Returns an editable note-event arrangement, not a rendered audio file.
 */
export const INSTRUMENTS = [
  'kick','snare','clap','hi-hat','tom','cymbal','808 bass','electric bass',
  'piano','electric piano','organ','acoustic guitar','electric guitar',
  'sitar','sarod','sarangi','tabla','dholak','dhol','tumbi','bansuri',
  'shehnai','harmonium','santoor','violin','cello','strings','flute',
  'trumpet','saxophone','synth lead','synth pad','bells','marimba','kalimba'
];
const ALIASES = {
  romantic:['piano','acoustic guitar','bansuri','strings'],
  punjabi:['dhol','tumbi','electric bass','clap'],
  haryanvi:['dholak','harmonium','tumbi','clap'],
  bollywood:['tabla','piano','strings','bansuri'],
  lofi:['electric piano','electric bass','hi-hat','snare'],
  trap:['808 bass','hi-hat','snare','synth lead'],
  classical:['tabla','sitar','sarangi','bansuri'],
  dance:['kick','clap','electric bass','synth lead']
};
const NOTES={C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function composeIdea(description,options={}){
  if(typeof description!=='string'||!description.trim())throw Error('Please describe your beat.');
  if(description.length>2000)throw Error('Description too long.');
  const text=description.toLowerCase(), found=INSTRUMENTS.filter(x=>text.includes(x));
  for(const [word,items] of Object.entries(ALIASES))if(text.includes(word))found.push(...items);
  const instruments=[...new Set(found)].slice(0,12);
  if(!instruments.length)instruments.push('kick','snare','hi-hat','piano','electric bass');
  const bpmMatch=text.match(/\b(\d{2,3})\s*bpm\b/);
  const bpm=Math.min(200,Math.max(50,Number(options.bpm||bpmMatch?.[1]||(text.includes('slow')?75:text.includes('fast')?135:100))));
  const keyMatch=text.match(/\b([a-g])(#)?\s*(minor|major)\b/i);
  const root=(keyMatch?.[1]||'C').toUpperCase()+(keyMatch?.[2]||'');
  const minor=keyMatch?.[3]?.toLowerCase()==='minor'||(!keyMatch&&/sad|emotional|melancholy/.test(text));
  const scale=minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
  const base=48+(NOTES[root]??0),seed=hash(text),bars=8,stepsPerBar=16;
  const tracks=instruments.map((instrument,index)=>{
    const events=[];
    for(let bar=0;bar<bars;bar++)for(let step=0;step<stepsPerBar;step++){
      const globalStep=bar*stepsPerBar+step;
      let hit=false,note=base+12+scale[(bar*3+index+Math.floor(step/4))%7],velocity=.65;
      if(instrument==='kick')hit=step%4===0;
      else if(instrument==='snare'||instrument==='clap')hit=step===4||step===12;
      else if(instrument==='hi-hat')hit=step%2===0;
      else if(['tabla','dholak','dhol'].includes(instrument))hit=[0,3,4,7,8,11,12,15].includes(step);
      else if(/bass|tumbi/.test(instrument)){hit=step%4===0;note=base-12+scale[bar%7]}
      else if(/pad|strings|organ|harmonium/.test(instrument)){hit=step===0;velocity=.4}
      else hit=step%4===0&&((seed+bar+step/4+index)%4!==0);
      if(hit)events.push({step:globalStep,note,velocity,durationSteps:/pad|strings|organ|harmonium/.test(instrument)?16:instrument==='hi-hat'?1:3});
    }
    return {instrument,events};
  });
  return {engine:'rhymeorbit-rule-composer-v1',generativeAI:false,origin:'algorithmically arranged from user text',description,bpm,key:root,mode:minor?'minor':'major',bars,stepsPerBar,seed,tracks,editable:true};
}
