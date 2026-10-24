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

/* YIN-style pitch estimator for a single voice. Only mic input should reach it.
 * Cumulative mean-normalized difference is more forgiving of imperfect vocals
 * than choosing a highly correlated single period from a tiny FFT window. */
export function detectPitch(samples, sampleRate) {
  if (!samples?.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;
  const step = sampleRate >= 32000 ? 2 : 1;
  const length = Math.floor(samples.length / step);
  const rate = sampleRate / step;
  const minLag = Math.max(2, Math.floor(rate / 1000));
  const maxLag = Math.min(Math.floor(rate / 70), Math.floor(length / 3));
  if (maxLag <= minLag + 2) return null;
  let energy = 0;
  for (let i = 0; i < length; i++) energy += samples[i * step] ** 2;
  if (Math.sqrt(energy / length) < 0.0045) return null;
  const window = Math.min(2048, length - maxLag);
  const difference = new Float32Array(maxLag + 1);
  let cumulative = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const delta = samples[i * step] - samples[(i + lag) * step];
      sum += delta * delta;
    }
    cumulative += sum;
    difference[lag] = cumulative ? sum * lag / cumulative : 1;
  }
  let bestLag = 0;
  let bestScore = Infinity;
  for (let lag = minLag; lag < maxLag; lag++) {
    if (difference[lag] < bestScore) {bestScore = difference[lag];bestLag = lag;}
    if (difference[lag] < 0.18) {
      while (lag + 1 <= maxLag && difference[lag + 1] < difference[lag]) lag++;
      bestLag = lag;
      bestScore = difference[lag];
      break;
    }
  }
  if (!bestLag || bestScore > 0.34) return null;
  const previous = difference[bestLag - 1];
  const centre = difference[bestLag];
  const next = difference[bestLag + 1];
  const denominator = previous - 2 * centre + next;
  const fractional = Math.abs(denominator) > 1e-7 ? 0.5 * (previous - next) / denominator : 0;
  const hz = rate / (bestLag + Math.max(-0.5, Math.min(0.5, fractional)));
  return hz >= 70 && hz <= 1000 ? hz : null;
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
