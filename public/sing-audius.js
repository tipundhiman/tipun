/* Audius Sing Along: public streaming, microphone-only recording and local
 * lyrics. Never copy or upload the Audius backing track. */
import { parseSingAlongLyrics, activeLyricIndex, duckTargetVolume } from './sing-audius-core.js';

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clock = seconds => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;
  const status = value => { $('ssAudiusStatus').textContent = value; };
  const searchStatus = value => { $('ssAudiusSearchStatus').textContent = value; };
  const lyricsStatus = value => { $('ssAudiusLyricStatus').textContent = value; };
  const lyricKey = id => `rhymeorbit-audius-lyrics-${id}`;
  let selected = null;
  let session = null;
  let latestSearch = 0;
  let searchController = null;
  let generation = 0;
  let loaded = false;
  let downloadUrl = null;
  let parsedLyrics = { timed: false, lines: [] };

  function normalize(track) {
    if (!track || track.is_available !== true || track.is_streamable !== true) return null;
    const id = typeof track.id === 'string' ? track.id : '';
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
    const duration = Number(track.duration);
    const permalink = typeof track.permalink === 'string' && /^\/[a-zA-Z0-9_/-]+$/.test(track.permalink) ? track.permalink : '';
    return {
      id, title: String(track.title || 'Community song').slice(0, 140),
      artist: String(track.user?.name || track.user?.handle || 'Audius creator').slice(0, 140),
      duration: Number.isFinite(duration) && duration > 0 && duration < 86400 ? duration : 0,
      audio: `https://api.audius.co/v1/tracks/${encodeURIComponent(id)}/stream`,
      source: 'https://audius.co' + permalink
    };
  }

  async function discover() {
    const query = $('ssAudiusQuery').value.trim();
    if (query.length < 2 || query.length > 80) { searchStatus('Enter 2–80 characters.'); return; }
    const request = ++latestSearch;
    searchController?.abort();
    searchController = new AbortController();
    $('ssAudiusList').replaceChildren();
    searchStatus('Searching Audius community music…');
    try {
      let tracks;
      try {
        const response = await fetch('https://api.audius.co/v1/tracks/search?query=' + encodeURIComponent(query) + '&limit=16', {
          signal: searchController.signal, cache: 'no-store'
        });
        if (!response.ok) throw Error('Public Audius unavailable');
        const data = await response.json();
        if (!Array.isArray(data?.data)) throw Error('Invalid Audius data');
        tracks = data.data.map(normalize).filter(Boolean);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        const response = await fetch('/api/catalog/audius/search?q=' + encodeURIComponent(query), {
          signal: searchController.signal, cache: 'no-store'
        });
        if (!response.ok) throw Error('Audius search unavailable');
        const data = await response.json();
        tracks = Array.isArray(data.tracks) ? data.tracks : [];
      }
      if (request !== latestSearch) return;
      const unique = new Set();
      const items = tracks.filter(track => {
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(track.id) || !/^https:\/\/api\.audius\.co\/v1\/tracks\/[A-Za-z0-9_-]+\/stream$/.test(track.audio)) return false;
        const key = (track.title + '|' + track.artist).toLocaleLowerCase();
        if (unique.has(key)) return false;
        unique.add(key); return true;
      }).sort((a, b) => {
        const rank = t => (t.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? 2 : 0) + (t.artist.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? 1 : 0);
        return rank(b) - rank(a);
      }).slice(0, 12);
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'track';
        button.dataset.id = item.id; button.setAttribute('aria-pressed', 'false');
        const icon = document.createElement('span'); icon.className = 'emoji'; icon.textContent = '🎧';
        const title = document.createElement('strong'); title.textContent = item.title;
        const artist = document.createElement('span'); artist.textContent = item.artist + (item.duration ? ' · ' + clock(item.duration) : '');
        button.append(icon, title, artist);
        button.addEventListener('click', () => selectTrack(item));
        $('ssAudiusList').append(button);
      }
      searchStatus(items.length ? `${items.length} playable Audius tracks. Select one to listen or sing.` : 'No playable matches. Try a song title, artist or genre.');
    } catch (error) {
      if (error.name === 'AbortError' || request !== latestSearch) return;
      searchStatus('Audius is not responding. Try again later; original karaoke songs still work.');
    }
  }

  function displayLyrics(seconds = 0, duration = 0) {
    const index = activeLyricIndex(parsedLyrics, seconds, duration, Number($('ssAudiusOffset').value));
    const count = parsedLyrics.lines.length;
    if (!count) {
      $('ssAudiusLyricLabel').textContent = 'ADD LYRICS TO FOLLOW ALONG';
      $('ssAudiusCurrent').textContent = 'Paste authorized lyrics below.';
      $('ssAudiusNext').textContent = 'Then tap Show & sync lyrics.';
      return;
    }
    $('ssAudiusLyricLabel').textContent = `${parsedLyrics.timed ? 'TIMED LYRICS' : 'ESTIMATED LYRICS'} · ${Math.max(0, index + 1)} / ${count}`;
    $('ssAudiusCurrent').textContent = index < 0 ? '♫ Intro — lyrics coming up' : parsedLyrics.lines[index].text;
    $('ssAudiusNext').textContent = parsedLyrics.lines[index + 1]?.text || '🎶 Keep singing from the heart';
  }

  function applyLyrics() {
    parsedLyrics = parseSingAlongLyrics($('ssAudiusLyrics').value);
    if (selected) {
      try {localStorage.setItem(lyricKey(selected.id), $('ssAudiusLyrics').value.slice(0, 8000));} catch {}
    }
    lyricsStatus(!parsedLyrics.lines.length
      ? 'Paste lyrics you own or are authorized to use; Audius does not provide verified synced lyrics.'
      : parsedLyrics.timed
        ? `${parsedLyrics.lines.length} timestamped lines loaded. They follow the song clock.`
        : `${parsedLyrics.lines.length} lines loaded. Timing is estimated across the song; use [mm:ss.xx] LRC for accurate sync.`);
    displayLyrics(session?.audio.currentTime || 0, currentDuration());
  }

  function selectTrack(item) {
    stop(); selected = item;
    for (const button of $('ssAudiusList').children) button.setAttribute('aria-pressed', String(button.dataset.id === item.id));
    $('ssAudiusSongTitle').textContent = item.title;
    $('ssAudiusArtist').textContent = `${item.artist} · Audius community upload`;
    $('ssAudiusSource').href = item.source;
    $('ssAudiusSource').hidden = false;
    $('ssAudiusListen').disabled = false; $('ssAudiusSing').disabled = false;
    $('ssAudiusDownload').hidden = true;
    $('ssAudiusLyrics').value = '';
    try { $('ssAudiusLyrics').value = localStorage.getItem(lyricKey(item.id)) || ''; } catch {}
    applyLyrics();
    showProgress(0);
    status('Ready! Listen first, then wear headphones and tap Sing & record.');
  }

  function currentDuration() {
    const value = session?.audio.duration;
    return Number.isFinite(value) && value > 0 ? value : selected?.duration || 0;
  }
  function showProgress(seconds) {
    const total = currentDuration();
    $('ssAudiusTime').textContent = clock(seconds);
    $('ssAudiusDuration').textContent = total ? clock(total) : '—';
    const progress = total ? Math.min(100, Math.round(seconds / total * 100)) : 0;
    $('ssAudiusProgressFill').style.width = progress + '%';
    $('ssAudiusProgress').setAttribute('aria-valuenow', String(progress));
    displayLyrics(seconds, total);
  }

  const supportedMime = () => {
    if (!window.MediaRecorder) return null;
    return ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']
      .find(type => MediaRecorder.isTypeSupported(type)) || null;
  };
  const fileExt = type => type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';

  async function recordingReady(chunks, type, title) {
    if (!chunks.length) {status('Recording is empty. Please try again.');return;}
    const blob = new Blob(chunks, {type});
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(blob);
    const ext = fileExt(type);
    const link = $('ssAudiusDownload');
    link.href = downloadUrl; link.download = `rhymeorbit-audius-voice-${Date.now()}.${ext}`; link.hidden = false;
    try {
      await window.roSaveAudiusSinging(blob, ext, title);
      status('✓ Your microphone-only take is ready and saved locally in My Recordings. Download a copy to keep it.');
    } catch { status('✓ Voice-only take ready. Please download it now; browser storage is unavailable.'); }
  }

  function stop() {
    generation++;
    const active = session;
    session = null;
    if (active) {
      clearInterval(active.tick);
      clearTimeout(active.limit);
      active.audio.pause();
      active.audio.removeAttribute('src'); active.audio.load();
      if (active.recorder?.state === 'recording') active.recorder.stop();
      active.mic?.getTracks().forEach(track => track.stop());
      active.context?.close().catch(() => {});
    }
    $('ssAudiusMicLevel').style.width = '0%';
    $('ssAudiusStop').disabled = true;
    $('ssAudiusListen').disabled = !selected;
    $('ssAudiusSing').disabled = !selected;
  }

  async function start(record) {
    if (!selected) return;
    stop();
    const token = generation;
    const type = record ? supportedMime() : null;
    if (record && (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !type)) {
      status('Singing requires microphone access, HTTPS and a browser supporting audio recording.'); return;
    }
    let audio = null, mic = null, context = null;
    $('ssAudiusListen').disabled = true; $('ssAudiusSing').disabled = true;
    $('ssAudiusDownload').hidden = true;
    status(record ? 'Requesting microphone access…' : 'Loading Audius audio…');
    try {
      if (record) mic = await navigator.mediaDevices.getUserMedia({
        audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: false}
      });
      if (token !== generation) {mic?.getTracks().forEach(track => track.stop());return;}
      audio = new Audio();
      // iOS Safari ignores HTMLMediaElement.volume. Route the cross-origin
      // Audius stream through Web Audio gain during singing instead.
      audio.crossOrigin = 'anonymous';
      audio.src = selected.audio;
      audio.preload = 'metadata';
      audio.volume = Number($('ssAudiusVolume').value) / 100;
      let analyser = null, buffer = null, recorder = null, musicGain = null;
      if (record) {
        context = new AudioContext();
        await context.resume();
        musicGain = context.createGain();
        musicGain.gain.value = Number($('ssAudiusVolume').value) / 100;
        audio.volume = 1;
        context.createMediaElementSource(audio).connect(musicGain).connect(context.destination);
        analyser = context.createAnalyser(); analyser.fftSize = 2048;
        buffer = new Float32Array(analyser.fftSize);
        const mute = context.createGain(); mute.gain.value = 0;
        context.createMediaStreamSource(mic).connect(analyser).connect(mute).connect(context.destination);
        recorder = new MediaRecorder(mic, {mimeType: type, audioBitsPerSecond: 128000});
      }
      const chunks = [];
      if (recorder) {
        const title = selected.title;
        recorder.ondataavailable = event => {if (event.data?.size) chunks.push(event.data);};
        recorder.onstop = () => recordingReady(chunks, type, title);
      }
      const active = {audio, mic, context, recorder, musicGain, tick: null, limit: null, lastVoice: -10000};
      session = active;
      audio.addEventListener('timeupdate', () => {if (session === active) showProgress(audio.currentTime);});
      audio.addEventListener('ended', () => {if (session === active) stop();});
      audio.addEventListener('error', () => {if (session === active) {stop();status('Audius stream could not play. Try another track.');}});
      await audio.play();
      if (session !== active) return;
      if (recorder) recorder.start(250);
      $('ssAudiusStop').disabled = false;
      status(record ? '🔴 Recording your voice. Sing to lower the backing song automatically.' : '♫ Listening to Audius. Press Finish or select Sing & record to start a new take.');
      showProgress(0);
      active.tick = setInterval(() => {
        if (session !== active) return;
        showProgress(audio.currentTime);
        if (!analyser) {audio.volume = Number($('ssAudiusVolume').value) / 100;return;}
        analyser.getFloatTimeDomainData(buffer);
        let total = 0;
        for (const value of buffer) total += value * value;
        const rms = Math.sqrt(total / buffer.length);
        const now = performance.now();
        if (rms > 0.018) active.lastVoice = now;
        const singing = now - active.lastVoice < 650;
        const target = duckTargetVolume(singing ? 0.05 : 0, 0.018,
          Number($('ssAudiusVolume').value) / 100, Number($('ssAudiusDuck').value));
        const current = musicGain ? musicGain.gain.value : audio.volume;
        const next = Math.max(0, Math.min(1, current + (target - current) * (singing ? 0.38 : 0.10)));
        if (musicGain) musicGain.gain.value = next;
        else audio.volume = next;
        $('ssAudiusMicLevel').style.width = Math.min(100, Math.round(rms * 1400)) + '%';
      }, 90);
      // Bound recording duration to avoid excessively large on-device blobs.
      active.limit = setTimeout(() => {if (session === active) stop();}, 8 * 60 * 1000);
    } catch {
      if (session) stop();
      else {
        mic?.getTracks().forEach(track => track.stop());
        await context?.close().catch(() => {});
        audio?.pause();
        $('ssAudiusListen').disabled = !selected; $('ssAudiusSing').disabled = !selected;
      }
      if (token === generation || !session) status('Could not start audio or microphone. Check permissions, headphones and browser support.');
    }
  }

  $('ssAudiusForm').addEventListener('submit', event => {event.preventDefault();discover();});
  $('ssAudiusListen').addEventListener('click', () => start(false));
  $('ssAudiusSing').addEventListener('click', () => start(true));
  $('ssAudiusStop').addEventListener('click', () => {stop();status('Playback finished. Your voice recording is being prepared, if recorded.');});
  $('ssAudiusLyricsApply').addEventListener('click', applyLyrics);
  $('ssAudiusLyricsClear').addEventListener('click', () => {
    $('ssAudiusLyrics').value = '';
    applyLyrics();
    $('ssAudiusLyrics').focus();
    lyricsStatus('Lyrics cleared. Write or paste your own, then tap Save & show lyrics.');
  });
  $('ssAudiusLyricsReset').addEventListener('click', () => {
    if (selected) {try {localStorage.removeItem(lyricKey(selected.id));} catch {}}
    $('ssAudiusLyrics').value = '';
    parsedLyrics = {timed:false,lines:[]};
    displayLyrics(session?.audio.currentTime || 0, currentDuration());
    lyricsStatus('Saved custom lyrics removed for this track. You can start fresh.');
  });
  $('ssAudiusOffset').addEventListener('input', () => {
    $('ssAudiusOffsetLabel').textContent = $('ssAudiusOffset').value + 's';
    displayLyrics(session?.audio.currentTime || 0, currentDuration());
  });
  for (const [id, label] of [['ssAudiusVolume','ssAudiusVolumeLabel'],['ssAudiusDuck','ssAudiusDuckLabel']]) {
    $(id).addEventListener('input', () => {$(label).textContent = $(id).value + '%';});
  }
  document.addEventListener('ro:sing-view', event => {
    if (event.detail !== 'audius') {stop();return;}
    if (!loaded) {loaded = true;discover();}
  });
  if (location.hash === '#audius') {loaded = true;discover();}
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
  window.addEventListener('pagehide', () => {stop();if (downloadUrl) URL.revokeObjectURL(downloadUrl);});
})();
