/* Original browser-generated ambience and the best locally available narration voice.
   No copyrighted music samples, paid song credits, or external speech API calls. */
(function () {
  'use strict';
  function preferredVoice(language) {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const requested = String(language || 'en').split('-')[0].toLowerCase();
    const ranked = voices.map(voice => {
      const name = voice.name.toLowerCase();
      let score = voice.lang.toLowerCase().startsWith(requested) ? 100 : -60;
      if (/jenny|aria|sonia|natasha|samantha|zira|veena|heera|neerja|karen|victoria|moira|female/.test(name)) score += 32;
      if (/natural|neural|premium|enhanced|online/.test(name)) score += 30;
      if (/google/.test(name)) score += 8;
      if (/david|mark|daniel|guy|male/.test(name)) score -= 25;
      return { voice, score };
    }).sort((a, b) => b.score - a.score);
    return ranked[0]?.score > 0 ? ranked[0].voice : null;
  }
  function speak(text, options = {}) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      throw Error('Speech is unavailable in this browser.');
    }
    window.speechSynthesis.cancel();
    const phrase = new SpeechSynthesisUtterance(String(text || '').slice(0, 4000));
    const voice = preferredVoice(options.lang || 'en');
    if (voice) phrase.voice = voice;
    phrase.lang = voice?.lang || options.lang || 'en-IN';
    phrase.rate = options.rate ?? 1.06;
    phrase.pitch = options.pitch ?? 1.04;
    phrase.volume = .92;
    if (options.onend) phrase.onend = options.onend;
    if (options.onerror) phrase.onerror = options.onerror;
    window.speechSynthesis.speak(phrase);
    return voice?.name || 'device default voice';
  }
  function createAmbientMusic(context, output, options = {}) {
    if (!context || !output) throw Error('Audio output is not available');
    const mood = ['romantic','dreamy','happy','calm'].includes(options.mood) ? options.mood : 'romantic';
    const moods = {
      romantic: {tempo:930, fade:.78, cutoff:1450, gain:.65, chords:[
        [130.81,164.81,196,246.94],[110,164.81,196,261.63],
        [87.31,130.81,164.81,196],[98,146.83,196,246.94]]},
      dreamy: {tempo:810, fade:.85, cutoff:1850, gain:.60, chords:[
        [110,130.81,164.81,196],[146.83,174.61,220,261.63],
        [130.81,164.81,196,261.63],[98,146.83,196,246.94]]},
      happy: {tempo:550, fade:.48, cutoff:2900, gain:.58, chords:[
        [146.83,185,220,293.66],[196,246.94,293.66,392],
        [164.81,196,261.63,329.63],[174.61,220,261.63,349.23]]},
      calm: {tempo:1150, fade:1.1, cutoff:1000, gain:.55, chords:[
        [98,146.83,174.61,220],[87.31,130.81,174.61,196],
        [110,146.83,174.61,220],[82.41,123.47,164.81,196]]}
    };
    const settings = moods[mood];
    const master = context.createGain();
    master.gain.setValueAtTime(.0001,context.currentTime);
    master.gain.linearRampToValueAtTime(settings.gain,context.currentTime+.35);
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';lowpass.frequency.value = settings.cutoff;
    master.connect(lowpass);lowpass.connect(output);
    // Four different original chord progressions; all notes synthesized locally.
    const chords = settings.chords;
    const voices = chords[0].map((freq, index) => {
      const oscillator = context.createOscillator();
      const level = context.createGain();
      oscillator.type = mood==='happy' && index>1 ? 'triangle' : 'sine';
      oscillator.frequency.value = freq;
      level.gain.value = index === 0 ? .085 : .053;
      oscillator.connect(level).connect(master);
      oscillator.start();
      return { oscillator, level };
    });
    const shimmer = context.createOscillator();
    const depth = context.createGain();
    shimmer.type = 'sine';shimmer.frequency.value = .33;
    depth.gain.value = .028;
    shimmer.connect(depth).connect(master.gain);
    shimmer.start();
    const origin = context.currentTime;
    let step = 0;
    const change = () => {
      const now = context.currentTime;
      const chord = chords[(step++) % chords.length];
      voices.forEach((voice, index) => voice.oscillator.frequency.setTargetAtTime(chord[index], now, .95));
    };
    change();
    const interval = setInterval(change,settings.tempo*6);
    let beat = 0;
    const melody = setInterval(() => {
      const now = context.currentTime;
      const chord = chords[Math.floor(beat / 8) % chords.length];
      const positions = [0, 2, 3, 2, 1, 2, 3, 1];
      const tone = context.createOscillator();
      const envelope = context.createGain();
      tone.type = mood==='happy' ? 'triangle' : 'sine';
      tone.frequency.value = chord[positions[beat % positions.length]] * 2;
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(mood === 'happy' ? .062 : .074,now+.032);
      envelope.gain.exponentialRampToValueAtTime(.0001,now+settings.fade);
      tone.connect(envelope).connect(master);
      tone.start(now);tone.stop(now+settings.fade+.05);
      beat++;
    },settings.tempo);
    let closed = false;
    return {
      stop() {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearInterval(melody);
        const end = context.currentTime + .08;
        master.gain.setTargetAtTime(0, context.currentTime, .018);
        for (const { oscillator } of voices) { try { oscillator.stop(end); } catch {} }
        try { shimmer.stop(end); } catch {}
      },
      elapsed: () => context.currentTime - origin
    };
  }
  window.roCreativeAudio = { preferredVoice, speak, createAmbientMusic };
})();
