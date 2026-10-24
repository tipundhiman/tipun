/* Free, local-only RhymeOrbit Vocal Lab. No upload, model service, or network requests. */
(() => {
  'use strict';
  const MAX_BYTES = 25 * 1024 * 1024;
  const MAX_DURATION = 120;
  const $ = id => document.getElementById(id);
  const audioFile = $('audioFile');
  const processBtn = $('processBtn');
  const downloadBtn = $('downloadBtn');
  const recordBtn = $('recordBtn');
  const stopBtn = $('stopBtn');
  const beforeAudio = $('beforeAudio');
  const afterAudio = $('afterAudio');
  const dropZone = $('dropZone');
  const status = message => { $('status').textContent = message; };
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  let source = null;
  let decoded = null;
  let outputBuffer = null;
  let sourceUrl = null;
  let outputUrl = null;
  let mediaRecorder = null;
  let mediaStream = null;
  let recordingTimer = null;
  let activeLoad = 0;
  let processVersion = 0;
  let busy = false;

  const presets = {
    gentle: { gate: 20, clarity: 25 },
    balanced: { gate: 50, clarity: 50 },
    strong: { gate: 80, clarity: 80 }
  };
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  function updateSliders() {
    $('gateValue').textContent = $('gate').value + '%';
    $('clarityValue').textContent = $('clarity').value + '%';
    invalidateOutput();
  }
  function invalidateOutput() {
    processVersion++;
    outputBuffer = null;
    downloadBtn.disabled = true;
    $('processedInfo').textContent = 'Not processed';
    afterAudio.removeAttribute('src');
    afterAudio.load();
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
    drawWaveform($('afterCanvas'), null, '#e5c9a2');
  }
  $('preset').addEventListener('change', () => {
    const preset = presets[$('preset').value] || presets.balanced;
    $('gate').value = String(preset.gate);
    $('clarity').value = String(preset.clarity);
    updateSliders();
  });
  for (const id of ['gate', 'clarity']) {
    $(id).addEventListener('input', updateSliders);
  }
  beforeAudio.addEventListener('play', () => afterAudio.pause());
  afterAudio.addEventListener('play', () => beforeAudio.pause());

  function drawWaveform(canvas, buffer, color) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0e1018';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff20';
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    if (!buffer) return;
    const samples = buffer.getChannelData(0);
    const samplesPerColumn = Math.max(1, Math.floor(samples.length / w));
    ctx.fillStyle = color;
    for (let x = 0; x < w; x++) {
      const start = x * samplesPerColumn;
      let peak = 0;
      for (let i = start; i < Math.min(samples.length, start + samplesPerColumn); i += 2) {
        peak = Math.max(peak, Math.abs(samples[i]));
      }
      const bar = clamp(peak * h * .88, 2, h - 6);
      ctx.fillRect(x, (h - bar) / 2, 1, bar);
    }
  }

  async function durationFromMetadata(url) {
    // Reject long compressed recordings before decoding them into large PCM buffers.
    const probe = new Audio();
    probe.preload = 'metadata';
    return new Promise(resolve => {
      let done = false;
      const finish = duration => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        probe.removeAttribute('src');
        probe.load();
        resolve(duration);
      };
      const timeout = setTimeout(() => finish(null), 6000);
      probe.addEventListener('loadedmetadata', () => finish(probe.duration), { once: true });
      probe.addEventListener('error', () => finish(null), { once: true });
      probe.src = url;
    });
  }

  async function loadAudio(blob, fileName) {
    const attempt = ++activeLoad;
    if (!AudioContextClass || !OfflineAudioContextClass) {
      status('This browser does not support audio processing. Try an updated Chrome, Edge, Firefox or Safari.');
      return;
    }
    if (!blob || blob.size < 100 || blob.size > MAX_BYTES) {
      status('Please choose an audio recording between 100 bytes and 25 MB.');
      return;
    }
    source = null;
    decoded = null;
    processBtn.disabled = true;
    invalidateOutput();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(blob);
    beforeAudio.src = sourceUrl;
    $('originalInfo').textContent = 'Reading audio…';
    drawWaveform($('beforeCanvas'), null, '#b2a0e9');
    status('Checking recording length and decoding audio…');
    const metadataSeconds = await durationFromMetadata(sourceUrl);
    if (attempt !== activeLoad) return;
    if (Number.isFinite(metadataSeconds) && metadataSeconds > MAX_DURATION) {
      $('originalInfo').textContent = 'Too long';
      status('Maximum recording length is 2 minutes. Trim your audio and try again.');
      return;
    }
    let ctx;
    try {
      ctx = new AudioContextClass();
      const input = await blob.arrayBuffer();
      const buffer = await ctx.decodeAudioData(input);
      if (attempt !== activeLoad) return;
      if (buffer.duration > MAX_DURATION || buffer.numberOfChannels > 2 || buffer.sampleRate > 96000) {
        status('Use audio up to 2 minutes, stereo, and 96 kHz sample rate.');
        $('originalInfo').textContent = 'Unsupported recording';
        return;
      }
      source = { blob, name: fileName || 'my-vocals' };
      decoded = buffer;
      $('originalInfo').textContent = buffer.duration.toFixed(1) + ' sec';
      drawWaveform($('beforeCanvas'), buffer, '#b2a0e9');
      processBtn.disabled = false;
      status('Ready! Select a style, then click “Clean my vocals”.');
    } catch (error) {
      $('originalInfo').textContent = 'Unsupported audio';
      status('This file could not be decoded in your browser. Try a WAV or MP3 recording.');
      console.info('Vocal Lab decode failure:', error?.name || 'Error');
    } finally {
      await ctx?.close().catch(() => {});
    }
  }

  audioFile.addEventListener('change', () => {
    const file = audioFile.files?.[0];
    if (file) loadAudio(file, file.name);
  });
  for (const type of ['dragenter', 'dragover']) {
    dropZone.addEventListener(type, e => { e.preventDefault(); dropZone.classList.add('dragging'); });
  }
  for (const type of ['dragleave', 'drop']) {
    dropZone.addEventListener(type, e => { e.preventDefault(); dropZone.classList.remove('dragging'); });
  }
  dropZone.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.name))) loadAudio(file, file.name);
    else status('Please drop an audio file, such as WAV or MP3.');
  });

  recordBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      status('This browser does not support microphone recording. You can still upload audio.');
      return;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false }, video: false });
      const chunks = [];
      mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorder.addEventListener('dataavailable', e => { if (e.data.size) chunks.push(e.data); });
      mediaRecorder.addEventListener('stop', () => {
        clearTimeout(recordingTimer);
        mediaStream?.getTracks().forEach(track => track.stop());
        mediaStream = null;
        recordBtn.disabled = false;
        stopBtn.disabled = true;
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (blob.size) loadAudio(blob, 'rhymeorbit-recording');
        else status('No recording captured. Please try again.');
      }, { once: true });
      mediaRecorder.start(250);
      recordBtn.disabled = true;
      stopBtn.disabled = false;
      status('Recording… Sing or speak, then click Stop. Maximum 2 minutes.');
      recordingTimer = setTimeout(() => {
        if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
      }, MAX_DURATION * 1000);
    } catch {
      mediaStream?.getTracks().forEach(track => track.stop());
      mediaStream = null;
      status('Microphone permission was denied or unavailable. Choose an audio file instead.');
    }
  });
  stopBtn.addEventListener('click', () => {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  });

  function gatedBuffer(input, offline, gateStrength) {
    const channels = input.numberOfChannels;
    const frames = input.length;
    const next = offline.createBuffer(channels, frames, input.sampleRate);
    const inChannels = Array.from({ length: channels }, (_, ch) => input.getChannelData(ch));
    const outChannels = Array.from({ length: channels }, (_, ch) => next.getChannelData(ch));
    const threshold = Math.pow(10, (-74 + gateStrength * .36) / 20);
    const minimumGain = clamp(1 - gateStrength / 110, .08, 1);
    let gain = 1;
    for (let start = 0; start < frames; start += 512) {
      const end = Math.min(frames, start + 512);
      let energy = 0;
      for (let ch = 0; ch < channels; ch++) {
        for (let i = start; i < end; i += 4) energy += inChannels[ch][i] ** 2;
      }
      const rms = Math.sqrt(energy / Math.max(1, Math.ceil((end - start) / 4) * channels));
      const target = rms >= threshold ? 1 : clamp(rms / threshold, minimumGain, 1);
      for (let i = start; i < end; i++) {
        gain += (target - gain) * (target < gain ? .001 : .002);
        for (let ch = 0; ch < channels; ch++) outChannels[ch][i] = inChannels[ch][i] * gain;
      }
    }
    return next;
  }

  async function cleanVocals() {
    if (!decoded || busy) return;
    const input = decoded;
    const version = processVersion;
    busy = true;
    processBtn.disabled = true;
    downloadBtn.disabled = true;
    status('Cleaning locally… this can take a moment for longer recordings.');
    await new Promise(resolve => setTimeout(resolve, 25));
    try {
      if (version !== processVersion) return;
      const gate = Number($('gate').value);
      const clarity = Number($('clarity').value);
      const offline = new OfflineAudioContextClass(input.numberOfChannels, input.length, input.sampleRate);
      const sourceNode = offline.createBufferSource();
      sourceNode.buffer = gatedBuffer(input, offline, gate);
      const highpass = offline.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 55 + clarity * .52;
      const lowpass = offline.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = Math.min(input.sampleRate / 2 - 120, 17500 - gate * 60);
      const presence = offline.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3400;
      presence.Q.value = .8;
      presence.gain.value = (clarity / 100) * 3;
      const compressor = offline.createDynamicsCompressor();
      compressor.threshold.value = -25;
      compressor.knee.value = 18;
      compressor.ratio.value = 2.2 + clarity / 75;
      compressor.attack.value = .015;
      compressor.release.value = .24;
      sourceNode.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(presence);
      presence.connect(compressor);
      compressor.connect(offline.destination);
      sourceNode.start(0);
      const rendered = await offline.startRendering();
      if (version !== processVersion) return;
      // Normalize only downward if necessary; avoid clipping after EQ/compression.
      let peak = 0;
      for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
        const samples = rendered.getChannelData(ch);
        for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
      }
      if (peak > .97) {
        const factor = .97 / peak;
        for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
          const samples = rendered.getChannelData(ch);
          for (let i = 0; i < samples.length; i++) samples[i] *= factor;
        }
      }
      outputBuffer = rendered;
      const wav = toWav(rendered);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = URL.createObjectURL(wav);
      afterAudio.src = outputUrl;
      $('processedInfo').textContent = (wav.size / 1048576).toFixed(1) + ' MB WAV';
      drawWaveform($('afterCanvas'), rendered, '#e5c9a2');
      downloadBtn.disabled = false;
      status('Done! Compare both players and download the cleaned WAV.');
    } catch (error) {
      status('Your browser could not process this recording. Try a shorter WAV or MP3.');
      console.info('Vocal Lab processing failure:', error?.name || 'Error');
    } finally {
      busy = false;
      processBtn.disabled = !decoded;
    }
  }

  function toWav(buffer) {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const sampleRate = buffer.sampleRate;
    const bytes = frames * channels * 2;
    const raw = new ArrayBuffer(44 + bytes);
    const view = new DataView(raw);
    const word = (at, value) => view.setUint16(at, value, true);
    const dword = (at, value) => view.setUint32(at, value, true);
    const ascii = (at, value) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
    ascii(0, 'RIFF'); dword(4, 36 + bytes); ascii(8, 'WAVE');
    ascii(12, 'fmt '); dword(16, 16); word(20, 1); word(22, channels);
    dword(24, sampleRate); dword(28, sampleRate * channels * 2);
    word(32, channels * 2); word(34, 16);
    ascii(36, 'data'); dword(40, bytes);
    const data = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch));
    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let ch = 0; ch < channels; ch++) {
        const sample = clamp(data[ch][i], -1, 1);
        view.setInt16(offset, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
        offset += 2;
      }
    }
    return new Blob([raw], { type: 'audio/wav' });
  }

  processBtn.addEventListener('click', cleanVocals);
  downloadBtn.addEventListener('click', () => {
    if (!outputBuffer || !outputUrl || !source) return;
    const a = document.createElement('a');
    const name = source.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 70) || 'recording';
    a.href = outputUrl;
    a.download = name + '-rhymeorbit-clean.wav';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  window.addEventListener('pagehide', () => {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    mediaStream?.getTracks().forEach(track => track.stop());
    clearTimeout(recordingTimer);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
  });
  drawWaveform($('beforeCanvas'), null, '#b2a0e9');
  drawWaveform($('afterCanvas'), null, '#e5c9a2');
})();
