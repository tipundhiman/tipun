/* Original RhymeOrbit karaoke practice repertoire. No third-party recordings. */
export const SONGS = Object.freeze([
  {
    id:'pehli-baarish', title:'Pehli Baarish', subtitle:'Hindi · Soft Love', emoji:'🌧️', bpm:84, bars:32,
    chords:[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]],
    notes:[64,62,60,62,64,67,64,62],
    lyrics:['Pehli baarish mein tera naam liya','Bheegi raahon ne paighaam diya','Dil ki dhadkan dheere se boli','Tu jo mila to har shaam khili','Baadal ke sang sapne udte hain','Teri hansi mein rang judte hain','Aaj ye pal kahin kho na jaaye','Saath tera yun hi reh jaaye']
  },
  {
    id:'dheere-dheere', title:'Dheere Dheere', subtitle:'Hindi · Calm Night', emoji:'🌙', bpm:76, bars:32,
    chords:[[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66],[164.81,196,261.63]],
    notes:[60,60,62,64,62,60,57,60],
    lyrics:['Dheere dheere shaam utarti hai','Khamoshi bhi baatein karti hai','Chaand ne poochha dil ka raaz','Maine kaha hai tu hi awaaz','Saanson mein ik narm tarana','Sapnon ko hai ghar tak jaana','Har pal ek nayi si roshni','Dil mein basi teri dosti']
  },
  {
    id:'udaan', title:'Udaan', subtitle:'Hindi · Happy Pop', emoji:'✨', bpm:92, bars:36,
    chords:[[261.63,329.63,392],[196,246.94,293.66],[220,261.63,329.63],[174.61,220,261.63]],
    notes:[60,62,64,67,67,64,62,60],
    lyrics:['Aaj se apni udaan shuru','Sapne kahen ab tu na ruk','Raaston par roshni si hai','Har naye din mein zindagi hai','Haathon mein kal ka aasmaan','Dil mein hai ek naya armaan','Gir ke uthna seekh liya','Khud par bharosa jeet liya','Chal chalein hum door kahin']
  },
  {
    id:'summer-lights', title:'Summer Lights', subtitle:'English · Dreamy Pop', emoji:'🌅', bpm:100, bars:40,
    chords:[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]],
    notes:[64,67,69,67,64,62,60,62],
    lyrics:['Summer lights across the sky','Little dreams are passing by','Hear the music in the air','Take my hand and meet me there','We can dance until the dawn','Every heartbeat carries on','Let the quiet stars be bright','We belong to this sweet night','Sing it softly one more time','Every moment has a rhyme']
  }
]);

export const durationOf = song => song.bars * 4 * 60 / song.bpm;
export const midiToHz = midi => 440 * 2 ** ((midi - 69) / 12);
export const hzToMidi = hz => hz > 0 ? 69 + 12 * Math.log2(hz / 440) : null;
export const targetAt = (song, seconds) => song.notes[Math.floor(Math.max(0, seconds) * song.bpm / 60) % song.notes.length];
export const lineAt = (song, seconds) => Math.min(song.lyrics.length - 1, Math.floor(Math.max(0, seconds) / durationOf(song) * song.lyrics.length));
export const pitchDistance = (heardMidi, wantedMidi) => {
  if (!Number.isFinite(heardMidi) || !Number.isFinite(wantedMidi)) return Infinity;
  const distance = Math.abs(heardMidi - wantedMidi) % 12;
  return Math.min(distance, 12 - distance);
};

/* Autocorrelation tuner for one voice. Accompaniment must not be fed into it. */
export function detectPitch(samples, sampleRate) {
  if (!samples?.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;
  let energy = 0;
  for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
  if (Math.sqrt(energy / samples.length) < 0.012) return null;
  const minLag = Math.floor(sampleRate / 850);
  const maxLag = Math.min(Math.floor(sampleRate / 95), Math.floor(samples.length / 2));
  const correlations = new Float32Array(maxLag + 1);
  let bestLag = 0;
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let diff = 0, power = 0;
    for (let i = 0; i < samples.length - lag; i += 2) {
      const a = samples[i], b = samples[i + lag];
      diff += (a - b) ** 2;
      power += a * a + b * b;
    }
    const correlation = power ? 1 - diff / power : 0;
    correlations[lag] = correlation;
    if (correlation > best) {best = correlation;bestLag = lag;}
  }
  if (best < 0.74 || bestLag === 0) return null;
  // Prefer the FIRST strong periodic peak. A global maximum at 2× or 4× the
  // period would otherwise mistake a sung A4 for A3 or A2.
  for(let lag=minLag+1;lag<maxLag;lag++){
    if(correlations[lag]>=Math.max(.83,best*.985) &&
       correlations[lag]>=correlations[lag-1] && correlations[lag]>=correlations[lag+1]){
      bestLag=lag;break;
    }
  }
  const l = correlations[bestLag - 1] || best;
  const r = correlations[bestLag + 1] || best;
  const delta = Math.abs(l - 2 * best + r) > 0.00001 ? .5 * (l - r) / (l - 2 * best + r) : 0;
  const frequency = sampleRate / (bestLag + Math.max(-.5, Math.min(.5, delta)));
  return frequency >= 95 && frequency <= 850 ? frequency : null;
}

export function summarizePerformance(samples) {
  const voiced = samples.filter(sample => Number.isFinite(sample.error));
  if (voiced.length < 8) return {score:null,coverage:0,tip:'Awaaz kam detect hui. Headphones laga kar mic ke paas thoda clearly gaao.'};
  const accurate = voiced.filter(sample => sample.error <= 1).length;
  const near = voiced.filter(sample => sample.error <= 2).length;
  const score = Math.round((accurate + (near - accurate) * .45) / voiced.length * 100);
  const avgError = voiced.reduce((sum,sample)=>sum + Math.min(sample.error,6),0) / voiced.length;
  const tip = score > 78 ? 'Bahut achha! Sur ko isi tarah hold karo.' : avgError > 2 ? 'Melody ko pehle suno, phir ek-ek line dheere gaao.' : 'Achha progress! Lambi notes ko thoda aur steady rakho.';
  return {score,coverage:voiced.length,tip};
}
