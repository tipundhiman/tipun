/* RhymeOrbit Music Video Maker: five animated ten-second scenes, locally encoded. */
(() => {
  'use strict';
  const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
  const MAX_VIDEO_SECONDS = 50;
  const SCENE_SECONDS = 10;
  const $ = id => document.getElementById(id);
  const canvas = $('vmCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  let audioBlob = null;
  let audioUrl = null;
  let downloadUrl = null;
  let audioDuration = 0;
  let audioTitle = 'My RhymeOrbit Song';
  let sourceName = '';
  let exporting = false;
  let recorder = null;
  let exportAudio = null;
  let exportContext = null;
  let exportStream = null;
  let exportTarget = MAX_VIDEO_SECONDS;
  let analyser = null;
  let spectrum = null;
  let previewStarted = performance.now();
  let activeLoad = 0;

  const themes = {
    romantic: [['#3d254d','#c27690'],['#332648','#8c78b6'],['#502b52','#dca18d'],['#253d55','#7893c4'],['#3d2248','#d17f9e']],
    night: [['#11152f','#3e5582'],['#191738','#807cc1'],['#142b4c','#4f6e9e'],['#0d2434','#578497'],['#251636','#805aa1']],
    lofi: [['#1b3440','#6e7684'],['#1f253d','#6b688c'],['#243c42','#929777'],['#2d283d','#847a8f'],['#1d384b','#457aa1']],
    sunset: [['#56304a','#de9571'],['#57434b','#e9bb89'],['#5d2d43','#d66b75'],['#3a4163','#a77c91'],['#332b4d','#d9966b']],
    neon: [['#20103d','#a54dcc'],['#11273e','#548cda'],['#35133d','#e363a4'],['#102e3b','#38acb3'],['#391839','#cb8bdb']]
  };
  const sceneNames = ['Dream', 'Float', 'Glow', 'Pulse', 'Forever'];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const status = text => { $('vmStatus').textContent = text; };

  function setTab(name) {
    for (const button of $('vmTabs').querySelectorAll('button[data-tab]')) {
      const selected = button.dataset.tab === name;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      $('vmPanel' + button.dataset.tab[0].toUpperCase() + button.dataset.tab.slice(1)).hidden = !selected;
    }
  }
  for (const button of $('vmTabs').querySelectorAll('button[data-tab]')) {
    button.onclick = () => setTab(button.dataset.tab);
  }
  for (const button of document.querySelectorAll('[data-next]')) {
    button.onclick = () => setTab(button.dataset.next);
  }
  $('vmLyricDelay').addEventListener('input', () => {
    $('vmLyricDelayValue').textContent = $('vmLyricDelay').value + ' sec';
  });
  $('vmAspect').addEventListener('change', () => {
    const portrait = $('vmAspect').value === 'portrait';
    canvas.width = portrait ? 720 : 1280;
    canvas.height = portrait ? 1280 : 720;
    canvas.style.aspectRatio = portrait ? '9 / 16' : '16 / 9';
  });
  $('vmAspect').dispatchEvent(new Event('change'));

  function setLoadedBlob(blob, label, originalName) {
    if (!blob || blob.size < 100 || blob.size > MAX_AUDIO_BYTES) {
      status('Choose an audio file between 100 bytes and 25 MB.');
      return;
    }
    const ticket = ++activeLoad;
    audioBlob = null;
    audioDuration = 0;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    const player = $('vmAudioPreview');
    player.src = audioUrl;
    player.onloadedmetadata = () => {
      if (ticket !== activeLoad) return;
      if (!Number.isFinite(player.duration) || player.duration < 1) {
        status('Song duration could not be read. Try another MP3 or WAV.');
        audioBlob = null;
        return;
      }
      audioBlob = blob;
      audioDuration = player.duration;
      audioTitle = label || 'My RhymeOrbit Song';
      sourceName = originalName || '';
      $('vmSavedTrack').hidden = false;
      $('vmSavedTrack').textContent = '♫ ' + audioTitle + ' · ' + audioDuration.toFixed(0) + ' seconds · ready';
      status('Music ready! The video will use up to the first 50 seconds of your song.');
      $('vmProgress').max = Math.min(MAX_VIDEO_SECONDS, audioDuration);
    };
    player.onerror = () => { if (ticket === activeLoad) { audioBlob = null; status('This audio format cannot be played by your browser.'); } };
  }
  $('vmAudioFile').addEventListener('change', () => {
    const file = $('vmAudioFile').files?.[0];
    if (file) setLoadedBlob(file, file.name.replace(/\.[^.]*$/, ''), file.name);
  });

  async function loadSavedSong() {
    let data;
    try {
      data = JSON.parse(sessionStorage.getItem('ro_video_selected_song') || 'null');
      sessionStorage.removeItem('ro_video_selected_song');
    } catch { return; }
    if (!data || typeof data !== 'object') return;
    if (typeof data.title === 'string') audioTitle = data.title.slice(0, 100);
    if (typeof data.lyrics === 'string') $('vmLyrics').value = data.lyrics.slice(0, 8000);
    const source = typeof data.proxyUrl === 'string' && /^\/api\/music\/audio\/[a-zA-Z0-9_-]{1,100}\?token=/.test(data.proxyUrl)
      ? data.proxyUrl : null;
    if (!source) {
      status('Saved song link expired or unavailable. Download it from Download Audio, then upload the file here.');
      return;
    }
    status('Loading your private song from RhymeOrbit…');
    try {
      let offset = 0;
      let total = 0;
      let type = 'audio/ogg';
      const chunks = [];
      for (let i = 0; i < 28; i++) {
        const response = await fetch(source, {
          headers: { Range: 'bytes=' + offset + '-' + (offset + 1024 * 1024 - 1) },
          cache: 'no-store'
        });
        if (response.status !== 206) throw Error('Private song link has expired. Refresh it in Download Audio.');
        const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '');
        if (!range || Number(range[1]) !== offset) throw Error('Incomplete song data.');
        total = Number(range[3]);
        if (!Number.isSafeInteger(total) || total < 100 || total > MAX_AUDIO_BYTES) throw Error('This song exceeds the 25 MB limit.');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== Number(range[2]) - offset + 1) throw Error('Incomplete song download.');
        chunks.push(bytes);
        type = (response.headers.get('Content-Type') || type).split(';')[0];
        offset = Number(range[2]) + 1;
        if (offset === total) break;
      }
      if (offset !== total) throw Error('The song did not finish loading.');
      setLoadedBlob(new Blob(chunks, { type }), audioTitle, 'rhymeorbit-song.ogg');
    } catch (error) {
      status((error?.message || 'Could not load saved audio.') + ' You can still upload an MP3 or WAV.');
    }
  }
  loadSavedSong();

  function drawGlow(x, y, radius, color, opacity) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color + Math.round(opacity * 255).toString(16).padStart(2, '0'));
    gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function drawScene(scene, seconds, opacity) {
    const palette = (themes[$('vmTheme').value] || themes.romantic)[scene];
    const w = canvas.width;
    const h = canvas.height;
    const time = seconds;
    ctx.save();
    ctx.globalAlpha = opacity;
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, palette[0]);
    bg.addColorStop(.55, '#121322');
    bg.addColorStop(1, palette[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    drawGlow(w * (.21 + .07 * Math.sin(time * .15)), h * .25, w * .5, '#f6d8c0', .15);
    drawGlow(w * .78, h * (.65 + .08 * Math.cos(time * .2)), w * .45, '#b996ff', .17);
    for (let i = 0; i < 70; i++) {
      const seed = ((i * 73 + scene * 47) % 997) / 997;
      const x = ((i * 97 + scene * 41) % 101) / 101 * w;
      const y = ((((i * 59) % 127) / 127 + time * (.004 + seed * .008)) % 1) * h;
      const size = 1 + (i % 4) * (w / 840);
      const wave = Math.sin(time * (1.1 + seed) + i) * 6;
      ctx.beginPath();
      if (scene % 2 === 0) {
        ctx.ellipse(x + wave, y, size * 1.7, size * 3.2, time * .1 + i, 0, Math.PI * 2);
      } else {
        ctx.arc(x + wave, y, size, 0, Math.PI * 2);
      }
      ctx.fillStyle = i % 3 === 0 ? '#ffe0af9c' : '#f6e9fc69';
      ctx.fill();
    }
    const curveY = h * (.72 + Math.sin(time * .21 + scene) * .05);
    ctx.strokeStyle = '#fff2e852';
    ctx.lineWidth = 1.8;
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const y = curveY + layer * h * .028 + Math.sin(x / (95 + layer * 18) + time * .8 + layer) * h * .012;
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function lyricLine(seconds, duration) {
    const lines = $('vmLyrics').value.split(/\r?\n/).map(line => line.trim())
      .filter(line => line && !/^\[(verse|chorus|intro|bridge|outro|hook|pre-chorus)[^\]]*\]$/i.test(line)).slice(0, 90);
    if (!lines.length) return audioTitle;
    const delay = Number($('vmLyricDelay').value) || 0;
    if (seconds < delay) return audioTitle;
    const adjusted = clamp((seconds - delay) / Math.max(1, duration - delay), 0, .999999);
    return lines[Math.floor(adjusted * lines.length)];
  }
  function drawVideo(second, strength = .2) {
    if (!ctx) return;
    const duration = audioBlob ? Math.min(MAX_VIDEO_SECONDS, audioDuration) : MAX_VIDEO_SECONDS;
    const time = clamp(second, 0, duration - .001);
    const scene = Math.min(4, Math.floor(time / SCENE_SECONDS));
    const sceneTime = time - scene * SCENE_SECONDS;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (scene > 0 && sceneTime < 1.1) {
      drawScene(scene - 1, time, 1);
      drawScene(scene, time, sceneTime / 1.1);
    } else drawScene(scene, time, 1);
    const w = canvas.width;
    const h = canvas.height;
    const portrait = h > w;
    const titleSize = Math.round(w * (portrait ? .036 : .022));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fffaf4e0';
    ctx.font = '700 ' + titleSize + 'px system-ui,sans-serif';
    ctx.fillText(audioTitle.slice(0, 44), w / 2, h * .135, w * .82);
    ctx.fillStyle = '#fff5e8';
    ctx.shadowColor = '#080514';
    ctx.shadowBlur = 18;
    ctx.font = '700 ' + Math.round(w * (portrait ? .067 : .041)) + 'px system-ui,sans-serif';
    const lyric = lyricLine(time, duration);
    const maxWidth = w * .86;
    const words = lyric.split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (current && ctx.measureText(candidate).width > maxWidth && lines.length < 2) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    const shown = lines.slice(0, 3);
    const rowH = w * (portrait ? .091 : .055);
    shown.forEach((line, i) => ctx.fillText(line, w / 2, h * .48 + (i - (shown.length - 1) / 2) * rowH, maxWidth));
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#f4dfc49e';
    ctx.fillStyle = '#f2d2a2';
    const amplitude = clamp(strength, .08, 1);
    const bars = 36;
    const gap = w * .0075;
    const width = w * .004;
    for (let i = 0; i < bars; i++) {
      const height = h * (.009 + amplitude * (.016 + .032 * (Math.sin(i * .4 + time * 5) ** 2)));
      ctx.fillRect(w / 2 - bars * gap / 2 + i * gap, h * .82 - height / 2, width, height);
    }
    ctx.font = '600 ' + Math.round(w * .015) + 'px system-ui,sans-serif';
    ctx.fillStyle = '#f3ddbfaf';
    ctx.fillText('RHYMEORBIT · ' + String(scene + 1).padStart(2, '0') + ' / 05', w / 2, h * .93);
    ctx.restore();
  }

  function playbackStrength() {
    if (!analyser || !spectrum) return .2;
    analyser.getByteFrequencyData(spectrum);
    const total = spectrum.slice(0, Math.max(1, Math.floor(spectrum.length / 3)))
      .reduce((sum, n) => sum + n, 0);
    return clamp(total / (Math.max(1, Math.floor(spectrum.length / 3)) * 165), .1, 1);
  }
  function drawLoop() {
    if (!document.hidden && !exporting) {
      const seconds = ((performance.now() - previewStarted) / 1000) % MAX_VIDEO_SECONDS;
      drawVideo(seconds, .32);
    } else if (exporting && exportAudio) {
      drawVideo(exportAudio.currentTime, playbackStrength());
    }
    requestAnimationFrame(drawLoop);
  }
  requestAnimationFrame(drawLoop);

  async function waitForMetadata(audio) {
    if (audio.readyState >= 1) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(Error('Could not read audio duration.')); }, 10000);
      const cleanup = () => {
        clearTimeout(timer);
        audio.removeEventListener('loadedmetadata', onLoad);
        audio.removeEventListener('error', onError);
      };
      const onLoad = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(Error('Cannot play selected audio.')); };
      audio.addEventListener('loadedmetadata', onLoad, { once: true });
      audio.addEventListener('error', onError, { once: true });
    });
  }
  function supportedMime() {
    if (!window.MediaRecorder) return '';
    return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm', 'video/mp4']
      .find(type => MediaRecorder.isTypeSupported(type)) || '';
  }
  function cleanupExport() {
    exporting = false;
    $('vmExport').disabled = false;
    $('vmStop').disabled = true;
    exportAudio?.pause();
    exportStream?.getTracks().forEach(track => track.stop());
    exportContext?.close().catch(() => {});
    exportAudio = null;
    exportContext = null;
    exportStream = null;
    analyser = null;
    spectrum = null;
    recorder = null;
  }
  async function exportVideo() {
    if (exporting) return;
    if (!audioBlob || !audioUrl) { setTab('music'); status('Choose a playable song first.'); return; }
    if (!$('vmRights').checked) { status('Confirm you own or are allowed to use the song and lyrics.'); return; }
    if (!ctx || !canvas.captureStream || !window.MediaRecorder || !window.AudioContext) {
      status('This browser cannot export video with audio. Try updated desktop Chrome or Edge.');
      return;
    }
    const mime = supportedMime();
    if (!mime) { status('Video export is not supported in this browser. Try updated Chrome or Edge.'); return; }
    $('vmExport').disabled = true;
    $('vmStop').disabled = false;
    $('vmDownloadResult').hidden = true;
    $('vmProgress').value = 0;
    exportTarget = Math.min(MAX_VIDEO_SECONDS, audioDuration);
    $('vmProgress').max = exportTarget;
    status('Preparing the five-scene video… keep this page visible.');
    try {
      exportAudio = new Audio(audioUrl);
      exportAudio.preload = 'auto';
      await waitForMetadata(exportAudio);
      exportContext = new AudioContext();
      await exportContext.resume();
      const source = exportContext.createMediaElementSource(exportAudio);
      analyser = exportContext.createAnalyser();
      analyser.fftSize = 256;
      spectrum = new Uint8Array(analyser.frequencyBinCount);
      const dest = exportContext.createMediaStreamDestination();
      source.connect(analyser);
      analyser.connect(dest);
      exportStream = canvas.captureStream(24);
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (!audioTrack) throw Error('Browser audio capture is unavailable.');
      exportStream.addTrack(audioTrack);
      const chunks = [];
      recorder = new MediaRecorder(exportStream, {
        mimeType: mime, videoBitsPerSecond: 2600000, audioBitsPerSecond: 160000
      });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const actualMime = recorder?.mimeType || mime;
        cleanupExport();
        if (!chunks.length) { status('No video was captured. Try again in desktop Chrome or Edge.'); return; }
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        const blob = new Blob(chunks, { type: actualMime });
        downloadUrl = URL.createObjectURL(blob);
        const ext = actualMime.includes('mp4') ? 'mp4' : 'webm';
        const name = (audioTitle || sourceName || 'RhymeOrbit').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60);
        const link = $('vmDownloadLink');
        link.href = downloadUrl;
        link.download = (name || 'RhymeOrbit') + '-50s-video.' + ext;
        link.textContent = '↓ Download ' + ext.toUpperCase() + ' video';
        $('vmFormatNote').textContent = 'Export completed locally · ' + (blob.size / 1048576).toFixed(1) + ' MB. Format: ' + ext.toUpperCase() + '.';
        $('vmDownloadResult').hidden = false;
        status('Your music video is ready! Click Download to save it.');
      };
      recorder.onerror = () => { status('Browser video recorder failed.'); };
      exporting = true;
      recorder.start(750);
      await exportAudio.play();
      status('Recording five 10-second scenes with your music…');
      const progressTimer = setInterval(() => {
        if (!exporting || !exportAudio) { clearInterval(progressTimer); return; }
        const value = Math.min(exportTarget, exportAudio.currentTime);
        $('vmProgress').value = value;
        $('vmProgressLabel').textContent = value.toFixed(0) + ' / ' + exportTarget.toFixed(0) + ' seconds encoded';
        if (value >= exportTarget - .08 || exportAudio.ended) {
          clearInterval(progressTimer);
          if (recorder?.state === 'recording') recorder.stop();
        }
      }, 120);
    } catch (error) {
      if (recorder?.state === 'recording') recorder.stop();
      else cleanupExport();
      status((error?.message || 'Video export could not start.') + ' Try a smaller MP3/WAV or updated desktop Chrome.');
    }
  }
  $('vmExport').addEventListener('click', exportVideo);
  $('vmStop').addEventListener('click', () => {
    if (recorder?.state === 'recording') recorder.stop();
    status('Export stopped. Any captured portion will still be available to download.');
  });
  window.addEventListener('pagehide', () => {
    exportAudio?.pause();
    exportStream?.getTracks().forEach(track => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  });
})();
