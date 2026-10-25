/* Listen & Chill shared cartoon-DJ audio player (Audius + Jamendo only).
 * HTMLAudioElement streams from the original provider; never download, record
 * or extract YouTube content. The official YouTube iframe remains separate. */
(() => {
  'use strict';
  let stage = null;
  let audio = null;
  let queue = [];
  let index = -1;
  let volume = 0.8;
  let playTicket = 0;

  const $ = id => document.getElementById(id);
  const clock = seconds => Number.isFinite(seconds) && seconds >= 0
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—:—';
  const allowAudio = (provider, input) => {
    try {
      const url = new URL(input);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      const host = url.hostname.toLowerCase();
      if (provider === 'audius' && host === 'api.audius.co' && /^\/v1\/tracks\/[A-Za-z0-9_-]+\/stream$/.test(url.pathname)) return url.href;
      if (provider === 'jamendo' && (host === 'storage.jamendo.com' || host.endsWith('.storage.jamendo.com'))) return url.href;
    } catch {}
    return null;
  };
  const validTrack = (provider, song) => {
    const src = allowAudio(provider, song?.audio);
    if (!src) return null;
    const duration = Number(song.duration);
    return { id: String(song.id || src), provider, src,
      duration: Number.isFinite(duration) && duration > 0 && duration < 86400 ? duration : 0,
      title: String(song.title || 'Community track').slice(0, 140),
      artist: String(song.artist || 'Independent artist').slice(0, 140) };
  };
  function setStatus(message) { if ($('roCcPlayStatus')) $('roCcPlayStatus').textContent = message; }
  function updateProgress() {
    if (!audio) return;
    const seekDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const duration = seekDuration || queue[index]?.duration || 0;
    const elapsed = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const slider = $('roCcSeek');
    if (slider) {
      slider.disabled = !seekDuration;
      slider.value = duration ? String(Math.min(1000, Math.round(elapsed / duration * 1000))) : '0';
      slider.setAttribute('aria-valuetext', `${clock(elapsed)} of ${duration ? clock(duration) : 'unknown duration'}`);
    }
    if ($('roCcElapsed')) $('roCcElapsed').textContent = clock(elapsed);
    if ($('roCcDuration')) $('roCcDuration').textContent = duration ? clock(duration) : '—:—';
  }
  function updateControls() {
    if (!audio || !stage) return;
    const hasSong = index >= 0 && index < queue.length;
    const playing = hasSong && !audio.paused && !audio.ended;
    stage.classList.toggle('playing', playing);
    const toggle = $('roCcToggle');
    if (toggle) { toggle.disabled = !hasSong; toggle.textContent = playing ? 'Ⅱ' : '▶'; toggle.setAttribute('aria-label', playing ? 'Pause song' : 'Play song'); }
    if ($('roCcPrev')) $('roCcPrev').disabled = !hasSong || index === 0;
    if ($('roCcNext')) $('roCcNext').disabled = !hasSong || index === queue.length - 1;
    if ($('roCcMute')) { $('roCcMute').textContent = audio.muted || audio.volume === 0 ? '🔇' : '🔊'; $('roCcMute').setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute'); }
    updateProgress();
  }
  async function startCurrent() {
    if (!audio || index < 0 || !queue[index]) return;
    const ticket = ++playTicket;
    const item = queue[index];
    if (audio.src !== item.src) { audio.src = item.src; audio.load(); }
    $('roCcNowTitle').textContent = item.title;
    $('roCcNowArtist').textContent = item.artist + ' · ' + (item.provider === 'audius' ? 'Audius' : 'Jamendo');
    setStatus('Loading the audio stream…');
    updateControls();
    try {
      await audio.play();
      if (ticket === playTicket) setStatus('♫ Now playing in the DJ lounge');
    } catch {
      if (ticket === playTicket) setStatus('Could not start this stream. Tap Play again or choose another track.');
    }
    updateControls();
  }
  function move(step) {
    const target = index + step;
    if (target < 0 || target >= queue.length) return;
    index = target;
    void startCurrent();
  }
  function mount() {
    const nextStage = $('roCcScene');
    if (!nextStage) return;
    if (stage === nextStage && audio === $('roCcAudio')) return;
    if (audio) { playTicket++; audio.pause(); audio.removeAttribute('src'); audio.load(); }
    stage = nextStage;
    queue = [];
    index = -1;
    if (!$('roCcAudio')) {
      const controls = document.createElement('section');
      controls.className = 'ro-cc-console';
      controls.setAttribute('aria-label', 'Animated music player');
      controls.innerHTML = '<div class="ro-cc-playing-tag">♫ YOUR DJ LOUNGE</div>' +
        '<div class="ro-cc-song-name" id="roCcNowTitle">Choose a song below</div>' +
        '<div class="ro-cc-song-artist" id="roCcNowArtist">Audius & Jamendo audio plays here</div>' +
        '<div class="ro-cc-transport" role="group" aria-label="Song controls">' +
        '<button type="button" id="roCcPrev" aria-label="Previous song" disabled>⏮</button>' +
        '<button type="button" id="roCcToggle" aria-label="Play song" class="ro-cc-main-play" disabled>▶</button>' +
        '<button type="button" id="roCcNext" aria-label="Next song" disabled>⏭</button></div>' +
        '<div class="ro-cc-seek-row"><span id="roCcElapsed">0:00</span>' +
        '<input type="range" min="0" max="1000" value="0" id="roCcSeek" aria-label="Seek in song" disabled>' +
        '<span id="roCcDuration">—:—</span></div>' +
        '<div class="ro-cc-volume-row"><button type="button" id="roCcMute" aria-label="Mute">🔊</button>' +
        '<input type="range" id="roCcVolume" min="0" max="100" value="80" aria-label="Music volume"></div>' +
        '<div class="ro-cc-play-status" id="roCcPlayStatus" role="status" aria-live="polite">Pick any audio track to start the animation ✨</div>' +
        '<audio id="roCcAudio" preload="none" aria-label="Selected song stream"></audio>';
      stage.append(controls);
    }
    audio = $('roCcAudio');
    audio.volume = volume;
    $('roCcVolume').value = String(Math.round(volume * 100));
    audio.addEventListener('play', updateControls);
    audio.addEventListener('pause', updateControls);
    audio.addEventListener('playing', () => { setStatus('♫ Now playing in the DJ lounge'); updateControls(); });
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('durationchange', updateProgress);
    audio.addEventListener('ended', () => { updateControls(); if (index < queue.length - 1) move(1); else setStatus('Playlist finished. Choose another song ✨'); });
    audio.addEventListener('error', () => { setStatus('This audio stream is unavailable. Try a different track.'); updateControls(); });
    $('roCcToggle').addEventListener('click', () => { if (audio.paused) void audio.play().catch(() => setStatus('Stream could not play. Try another song.')); else audio.pause(); });
    $('roCcPrev').addEventListener('click', () => move(-1));
    $('roCcNext').addEventListener('click', () => move(1));
    $('roCcSeek').addEventListener('input', event => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        try { audio.currentTime = Number(event.target.value) / 1000 * audio.duration; }
        catch { setStatus('Seeking is not available for this stream.'); }
      }
    });
    $('roCcVolume').addEventListener('input', event => { volume = Number(event.target.value) / 100; audio.volume = volume; if (volume > 0) audio.muted = false; updateControls(); });
    $('roCcMute').addEventListener('click', () => { audio.muted = !audio.muted; updateControls(); });
    updateControls();
  }
  function playFrom(provider, songs, id) {
    mount();
    if (!audio || !['audius', 'jamendo'].includes(provider) || !Array.isArray(songs)) return;
    const normalized = songs.map(song => validTrack(provider, song)).filter(Boolean).slice(0, 100);
    const target = normalized.findIndex(song => song.id === String(id));
    if (target === -1) { setStatus('That audio track is unavailable.'); return; }
    queue = normalized;
    index = target;
    void startCurrent();
    // The chosen track plays in the animated stage above the result cards.
    // Take the listener to its controls without breaking audio playback.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    stage.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }
  function pause() { playTicket++; audio?.pause(); }
  window.roCcPlayer = { mount, playFrom, pause };
  const beforeMount = window.roCcMount;
  window.roCcMount = function () { if (typeof beforeMount === 'function') beforeMount(); mount(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
