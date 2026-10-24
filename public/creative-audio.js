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
    phrase.rate = options.rate || .92;
    phrase.pitch = options.pitch || 1.07;
    phrase.volume = .92;
    if (options.onend) phrase.onend = options.onend;
    if (options.onerror) phrase.onerror = options.onerror;
    window.speechSynthesis.speak(phrase);
    return voice?.name || 'device default voice';
  }
  function createAmbientMusic(context, output) {
    if (!context || !output) throw Error('Audio output is not available');
    const master = context.createGain();
    master.gain.value = .34;
    master.connect(output);
    // Soft, original synthesizer chord progression; every note is generated locally.
    const chords = [[130.81, 164.81, 196, 261.63], [110, 164.81, 220, 261.63],
      [146.83, 174.61, 220, 293.66], [98, 146.83, 196, 246.94]];
    const voices = chords[0].map((freq, index) => {
      const oscillator = context.createOscillator();
      const level = context.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = freq;
      level.gain.value = index === 0 ? .06 : .036;
      oscillator.connect(level).connect(master);
      oscillator.start();
      return { oscillator, level };
    });
    const shimmer = context.createOscillator();
    const depth = context.createGain();
    shimmer.type = 'sine';shimmer.frequency.value = .33;
    depth.gain.value = .10;
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
    const interval = setInterval(change, 5800);
    let beat = 0;
    const melody = setInterval(() => {
      const now = context.currentTime;
      const chord = chords[Math.floor(beat / 8) % chords.length];
      const positions = [0, 2, 3, 2, 1, 2, 3, 1];
      const tone = context.createOscillator();
      const envelope = context.createGain();
      tone.type = 'sine';
      tone.frequency.value = chord[positions[beat % positions.length]] * 2;
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(.027, now + .025);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + .72);
      tone.connect(envelope).connect(master);
      tone.start(now);tone.stop(now + .75);
      beat++;
    }, 720);
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
