/* 30-second independent instrumental practice using the existing Jamendo API.
 * External music is streamed only. The recording contains microphone audio only.
 * Never download, remix, or save a third-party backing track here.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const displayTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const status = text => { $('ssIndieStatus').textContent = text; };
  const searchStatus = text => { $('ssIndieSearchStatus').textContent = text; };
  let selected = null;
  let running = null;
  let nextOffset = 0;
  let currentQuery = 'piano';
  let requestId = 0;
  let searchAbort = null;
  let recordingUrl = null;
  let loadedOnce = false;
  let runToken = 0;

  const trusted = (source, host) => {
    try {
      const url = new URL(source);
      return url.protocol === 'https:' && (url.hostname === host || url.hostname.endsWith('.' + host)) ? url.href : null;
    } catch { return null; }
  };
  function candidate(item) {
    return /^\d{1,14}$/.test(String(item?.id || '')) &&
      Number(item.duration) >= 30 &&
      trusted(item.audio, 'storage.jamendo.com') &&
      trusted(item.license, 'creativecommons.org') &&
      trusted(item.source, 'jamendo.com');
  }

  function selectedCredits(item) {
    const credits = $('ssIndieCredit');
    credits.replaceChildren();
    credits.append(document.createTextNode(`Music by ${item.artist} · `));
    for (const [title, url] of [['Jamendo track', item.source], ['Creative Commons license', item.license]]) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = title;
      credits.append(link, document.createTextNode(' · '));
    }
    credits.append(document.createTextNode('Recordings include your microphone only.'));
  }

  function selectSong(item) {
    stop();
    selected = item;
    for (const tile of $('ssIndieList').children) {
      tile.setAttribute('aria-pressed', String(tile.dataset.id === item.id));
    }
    $('ssIndieTitle').textContent = item.title;
    $('ssIndieArtist').textContent = `${item.artist} · Instrumental-tagged indie · ${displayTime(item.duration)}`;
    const maxStart = Math.max(0, Math.floor((item.duration - 30) / 5) * 5);
    const from = $('ssIndieFrom');
    from.max = String(maxStart);
    from.value = '0';
    from.disabled = maxStart === 0;
    $('ssIndieStartLabel').textContent = '0:00';
    $('ssIndieListen').disabled = false;
    $('ssIndieRecord').disabled = false;
    $('ssIndieDownload').hidden = true;
    selectedCredits(item);
    status('Ready! Listen to a 30-second segment or sing with headphones on.');
  }

  function tileFor(item) {
    const tile = document.createElement('button');
    tile.className = 'track';
    tile.type = 'button';
    tile.dataset.id = item.id;
    tile.setAttribute('aria-pressed', 'false');
    const icon = document.createElement('span');
    icon.className = 'emoji';
    icon.textContent = '🎼';
    const name = document.createElement('strong');
    name.textContent = item.title;
    const meta = document.createElement('span');
    meta.textContent = `${item.artist} · ${displayTime(item.duration)}`;
    tile.append(icon, name, meta);
    tile.addEventListener('click', () => selectSong(item));
    return tile;
  }

  async function discover(more = false) {
    const query = $('ssIndieQuery').value.trim();
    if (query.length < 2) {searchStatus('Enter at least 2 letters.');return;}
    if (more && (!nextOffset || query !== currentQuery)) return;
    if (!more) {currentQuery = query;nextOffset = 0;$('ssIndieList').replaceChildren();}
    const offset = more ? nextOffset : 0;
    searchAbort?.abort();
    searchAbort = new AbortController();
    const request = ++requestId;
    $('ssIndieMore').hidden = true;
    searchStatus(more ? 'Loading more indie instrumentals…' : 'Finding instrumental tracks…');
    try {
      const response = await fetch('/api/jamendo/search?q=' + encodeURIComponent(query) + '&offset=' + offset + '&instrumental=1', {
        signal: searchAbort.signal
      });
      const data = await response.json();
      if (request !== requestId) return;
      if (!response.ok) throw Error(data.error || 'Music catalog unavailable');
      const items = Array.isArray(data.items) ? data.items.filter(candidate) : [];
      $('ssIndieList').append(...items.map(tileFor));
      const count = $('ssIndieList').children.length;
      nextOffset = data.hasMore ? Number(data.nextOffset) : 0;
      $('ssIndieMore').hidden = !nextOffset;
      searchStatus(count
        ? `${count} independent instrumentals loaded. Select one to sing.`
        : 'No suitable instrumental found here. Try piano, love, rock or India.');
    } catch (error) {
      if (error.name === 'AbortError' || request !== requestId) return;
      searchStatus('Instrumental search temporarily unavailable. Existing original practice songs still work.');
      $('ssIndieMore').hidden = !more;
    }
  }

  const availableMime = () => {
    if (!window.MediaRecorder) return null;
    return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find(type => MediaRecorder.isTypeSupported(type)) || null;
  };
  const extension = type => type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';

  function stop() {
    // Invalidate a microphone permission prompt that may still be pending.
    runToken++;
    const session = running;
    if (!session) return;
    running = null;
    clearInterval(session.tick);
    clearTimeout(session.timeout);
    session.audio.pause();
    session.audio.removeAttribute('src');
    session.audio.load();
    if (session.recorder?.state === 'recording') session.recorder.stop();
    session.mic?.getTracks().forEach(track => track.stop());
    $('ssIndieStop').disabled = true;
    $('ssIndieListen').disabled = !selected;
    $('ssIndieRecord').disabled = !selected;
    $('ssIndieTimer').textContent = '30-second challenge complete';
    if (!session.recorder) status('Preview finished. Ready to sing your 30-second challenge.');
    else status('Recording finished. Preparing your voice-only download…');
  }

  async function finishRecording(chunks, type, title) {
    if (!chunks.length) {status('Microphone recording was empty. Please try again.');return;}
    const blob = new Blob(chunks, {type});
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = URL.createObjectURL(blob);
    const ext = extension(type);
    const download = $('ssIndieDownload');
    download.href = recordingUrl;
    download.download = `rhymeorbit-indie-voice-${Date.now()}.${ext}`;
    download.hidden = false;
    try {
      await window.roSaveIndieSinging(blob, ext, title);
      status('✓ Your voice-only take is ready and saved in My Recordings on this device. Download a copy to keep it.');
    } catch {
      status('✓ Your voice-only take is ready. Local storage unavailable; please download it now.');
    }
  }

  async function start(record) {
    if (!selected || running) return;
    const token = ++runToken;
    const type = record ? availableMime() : null;
    if (record && (!navigator.mediaDevices?.getUserMedia || !type)) {
      status('Recording needs microphone permission and a supported browser on HTTPS.');return;
    }
    let mic = null, audio = null;
    const from = Number($('ssIndieFrom').value) || 0;
    const track = selected;
    $('ssIndieListen').disabled = true;
    $('ssIndieRecord').disabled = true;
    $('ssIndieDownload').hidden = true;
    status(record ? 'Requesting microphone permission…' : 'Starting 30-second music preview…');
    try {
      if (record) mic = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}});
      if (token !== runToken) { mic?.getTracks().forEach(track => track.stop()); return; }
      audio = new Audio(track.audio);
      audio.preload = 'auto';
      audio.addEventListener('loadedmetadata', () => {audio.currentTime = from;}, {once:true});
      const recorder = record ? new MediaRecorder(mic, {mimeType:type,audioBitsPerSecond:128000}) : null;
      const chunks = [];
      if (recorder) {
        recorder.ondataavailable = event => {if (event.data?.size) chunks.push(event.data);};
        recorder.onstop = () => finishRecording(chunks, type, track.title);
      }
      const session = {audio,mic,recorder,started:Date.now(),tick:null,timeout:null};
      running = session;
      audio.addEventListener('timeupdate', () => {
        if (running === session && audio.currentTime >= from + 30) stop();
      });
      audio.addEventListener('ended', () => {if (running === session) stop();});
      audio.addEventListener('error', () => {if (running === session) {stop();status('Track stream stopped. Try another instrumental.');}});
      await audio.play();
      if (running !== session) return;
      session.started = Date.now();
      if (recorder) recorder.start(250);
      $('ssIndieStop').disabled = false;
      status(record ? '🔴 Singing with Jamendo instrumental. Your microphone only is recorded.' : '♫ Playing 30-second instrumental preview.');
      session.tick = setInterval(() => {
        if (running !== session) return;
        const elapsed = Math.min(30, (Date.now() - session.started) / 1000);
        $('ssIndieTimer').textContent = `${Math.max(0, Math.ceil(30 - elapsed))} seconds remaining`;
        if (elapsed >= 30) stop();
      }, 200);
      session.timeout = setTimeout(() => {if (running === session) stop();}, 31000);
    } catch (error) {
      if (token !== runToken) { mic?.getTracks().forEach(track => track.stop()); return; }
      if (running) stop();
      else mic?.getTracks().forEach(track => track.stop());
      audio?.pause();
      $('ssIndieListen').disabled = !selected;
      $('ssIndieRecord').disabled = !selected;
      status('Could not start music or microphone. Please check permissions and try again.');
    }
  }

  $('ssIndieForm').addEventListener('submit', event => {event.preventDefault();discover(false);});
  $('ssIndieMore').addEventListener('click', () => discover(true));
  $('ssIndieFrom').addEventListener('input', () => {$('ssIndieStartLabel').textContent = displayTime(Number($('ssIndieFrom').value));});
  $('ssIndieListen').addEventListener('click', () => start(false));
  $('ssIndieRecord').addEventListener('click', () => start(true));
  $('ssIndieStop').addEventListener('click', stop);
  document.addEventListener('ro:sing-view', event => {
    if (event.detail !== 'indie') {stop();return;}
    if (!loadedOnce) {loadedOnce = true;discover(false);}
  });
  if (location.hash === '#indie') {loadedOnce = true;discover(false);}
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
  window.addEventListener('pagehide', () => {stop();if (recordingUrl) URL.revokeObjectURL(recordingUrl);});
})();
