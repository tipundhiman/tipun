/* RhymeOrbit music videos: sequential ten-second animated scenes, locally encoded. */
(() => {
  'use strict';
  const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
  const MAX_VIDEO_SECONDS = 300;
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
  let exportAmbient = null;
  let exportTarget = MAX_VIDEO_SECONDS;
  let exportStartedAt = 0;
  let analyser = null;
  let spectrum = null;
  let previewStarted = performance.now();
  let previewAudio = null;
  let previewContext = null;
  let previewAmbient = null;
  let activeLoad = 0;
  let lyricsBeforeAI = null;
  let videoAuthClient = null;
  let savedSongs = [];
  let savedVideoObjectUrl = null;
  let selectedSongId = null;
  let lyricDraftVersion = 0;
  let transcribing = false;
  const TRANSCRIBE_LIMIT = 13 * 1024 * 1024;
  const lyricsInfo = message => { $('vmLyricsStatus').textContent = message; };
  $('vmLyrics').addEventListener('input', () => { lyricDraftVersion++; });

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
  const sourceLyricRows = () => $('vmLyrics').value.split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !/^\[(verse|chorus|intro|bridge|outro|hook|pre-chorus)[^\]]*\]$/i.test(line)).slice(0, 250);
  const lyricRows = () => window.roLyricSync.rows(sourceLyricRows().join('\n')).map(line => line.text);
  const useSelectedSong = () => $('vmAudioMode')?.value === 'auto' && !!(audioBlob && audioUrl);
  function videoDuration() {
    if (useSelectedSong()) return Math.min(MAX_VIDEO_SECONDS, Math.max(1, audioDuration));
    const requested = $('vmSilentDuration').value;
    if (requested !== 'auto') return Number(requested);
    return clamp(lyricRows().length * 4.5, 20, MAX_VIDEO_SECONDS);
  }
  function sceneCount() { return Math.max(1, Math.ceil(videoDuration() / SCENE_SECONDS)); }

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
    stopPreviewSound();
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
      status('Music ready! Video length: ' + Math.ceil(Math.min(MAX_VIDEO_SECONDS, audioDuration)) + ' seconds of your song.');
      $('vmProgress').max = Math.min(MAX_VIDEO_SECONDS, audioDuration);
    };
    player.onerror = () => { if (ticket === activeLoad) { audioBlob = null; status('This audio format cannot be played by your browser.'); } };
  }
  $('vmAudioFile').addEventListener('change', () => {
    const file = $('vmAudioFile').files?.[0];
    if (file) {
      selectedSongId = null;
      $('vmSaveSongLyrics').hidden = true;
      $('vmLyrics').value = '';
      lyricDraftVersion++;
      setLoadedBlob(file, file.name.replace(/\.[^.]*$/, ''), file.name);
      if ($('vmAutoTranscribe').checked) transcribeAudio(file);
    }
  });

  async function loadSavedSong(selected = null) {
    let data;
    try {
      if (selected) data = selected;
      else {
      data = JSON.parse(sessionStorage.getItem('ro_video_selected_song') || 'null');
      sessionStorage.removeItem('ro_video_selected_song');
      }
    } catch { return; }
    if (!data || typeof data !== 'object') return;
    const selectionTicket = ++activeLoad;
    selectedSongId = typeof data.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.id) ? data.id : null;
    $('vmSaveSongLyrics').hidden = !selectedSongId;
    $('vmLyrics').value = '';
    lyricDraftVersion++;
    if (typeof data.title === 'string') audioTitle = data.title.slice(0, 100);
    if (typeof data.lyrics === 'string') $('vmLyrics').value = data.lyrics.slice(0, 8000);
    if (selectedSongId) {
      try {
        const existing = await (await apiRequest('/api/music/lyrics?taskId=' + encodeURIComponent(selectedSongId))).json();
        if (selectionTicket !== activeLoad) return;
        if (existing.saved && existing.lyrics) $('vmLyrics').value = existing.lyrics;
        lyricsInfo($('vmLyrics').value.trim() ? '✓ Saved lyrics loaded. You can edit and save changes.' : 'No saved lyrics yet. Audio transcription will try to recover them.');
      } catch (error) {
        lyricsInfo('Could not load cloud lyrics: ' + error.message + '. You can still transcribe or type them.');
      }
    }
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
      const downloaded = new Blob(chunks, { type });
      if (selectionTicket !== activeLoad) return;
      setLoadedBlob(downloaded, audioTitle, 'rhymeorbit-song.ogg');
      if (!$('vmLyrics').value.trim() && $('vmAutoTranscribe').checked) transcribeAudio(downloaded);
    } catch (error) {
      status((error?.message || 'Could not load saved audio.') + ' You can still upload an MP3 or WAV.');
    }
  }
  loadSavedSong();

  // Reuse the same signed-in session and authenticated Gemini route as AI Studio.
  // Never expose the Gemini API key or Supabase service-role key in this page.
  async function aiSessionToken() {
    if (!window.supabase?.createClient) throw Error('Sign-in service is unavailable. Refresh the page and try again.');
    if (!videoAuthClient) {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw Error('RhymeOrbit authentication is temporarily unavailable.');
      const config = await response.json();
      if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(config.supabaseUrl || '') ||
          typeof config.supabaseAnonKey !== 'string' || config.supabaseAnonKey.length < 20) {
        throw Error('RhymeOrbit authentication is not configured.');
      }
      videoAuthClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    const { data, error } = await videoAuthClient.auth.getSession();
    if (error) throw Error('Could not verify your session. Sign in again on RhymeOrbit.');
    if (!data?.session?.access_token) throw Error('Sign in to RhymeOrbit first to use AI, browse songs, or open your private My Videos library.');
    return data.session.access_token;
  }

  async function apiRequest(path, options = {}) {
    const token = await aiSessionToken();
    const response = await fetch(path, {
      ...options,
      headers: { Authorization: 'Bearer ' + token, ...(options.headers || {}) },
      cache: 'no-store'
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw Error(body.error || `Request failed (${response.status}).`);
    }
    return response;
  }

  async function transcribeAudio(blob, { timed = false } = {}) {
    if (transcribing) {
      const message='AI is already processing your audio. Please wait for it to finish.';
      lyricsInfo(message); if (timed) $('vmSyncStatus').textContent=message;
      return;
    }
    if (!blob) {
      const message='First choose a saved song or upload your own MP3/WAV in Step 1 · Music.';
      lyricsInfo(message); if (timed) $('vmSyncStatus').textContent=message;
      return;
    }
    if (blob.size > TRANSCRIBE_LIMIT) {
      const message='This audio is over 13 MB. Use a smaller MP3 for AI timing, or mark lyric lines manually while playing.';
      lyricsInfo(message); if (timed) $('vmSyncStatus').textContent=message;
      return;
    }
    const thisSong = selectedSongId;
    const startedWith = lyricDraftVersion;
    transcribing = true;
    $('vmTranscribe').disabled = true;
    $('vmAutoSync').disabled = true;
    lyricsInfo(timed ? '🎯 Gemini is estimating the start time of every sung line… Please wait.' : '🎙 Gemini is listening for words in your recording. This can take a minute…');
    if (timed) $('vmSyncStatus').textContent='🎯 Listening to your song and matching sung lines with the audio timeline…';
    try {
      const response = await apiRequest('/api/lyrics/transcribe' + (timed ? '?timed=1' : ''), {
        method: 'POST', headers: { 'Content-Type': /\.m4a$/i.test(blob.name || sourceName) ? 'audio/mp4' : (blob.type || 'audio/mpeg').split(';')[0] }, body: blob
      });
      const result = await response.json();
      if (thisSong !== selectedSongId || startedWith !== lyricDraftVersion) {
        lyricsInfo('You changed the song or lyrics while transcription was running; existing text was kept.');
        return;
      }
      if (!result.lyrics) throw Error('No audible lyrics were found.');
      $('vmLyrics').value = result.lyrics.slice(0, 8000);
      lyricDraftVersion++;
      lyricsInfo(timed ? '✓ Line timestamps estimated. Play the song and review each timecode; AI timing may need manual corrections.' : '✓ Audio lyrics detected. Review mistakes and' + (selectedSongId ? ' select “Save lyrics to this song” for your R2 library.' : ' edit the text before exporting.'));
      if (timed) $('vmSyncStatus').textContent = '✓ AI-timed lyrics ready. Each [mm:ss.xx] timecode controls both preview and exported video. Adjust any line manually before export.';
    } catch (error) { lyricsInfo('Audio transcription unavailable: ' + error.message + ' You can type or generate lyrics instead.'); if (timed) $('vmSyncStatus').textContent = 'Could not time lyrics: ' + error.message + ' Existing lyrics are safe; use Mark next lyric as a fallback.'; }
    finally { transcribing = false; $('vmTranscribe').disabled = false; $('vmAutoSync').disabled = false; }
  }
  $('vmTranscribe').addEventListener('click', () => transcribeAudio(audioBlob || $('vmAudioFile').files?.[0]));
  $('vmAutoSync').addEventListener('click', () => transcribeAudio(audioBlob || $('vmAudioFile').files?.[0], {timed:true}));
  $('vmMarkLyric').addEventListener('click', () => {
    const player = $('vmAudioPreview');
    if (!audioBlob || !Number.isFinite(player.currentTime)) {
      $('vmSyncStatus').textContent = 'Choose or upload your song, then play it before marking lyrics.';return;
    }
    const rows = window.roLyricSync.rows(sourceLyricRows().join('\n'));
    if(!rows.length){$('vmSyncStatus').textContent='Add lyrics first, one line per row.';return;}
    const next = rows.findIndex(line => !Number.isFinite(line.start));
    if (next < 0){$('vmSyncStatus').textContent='✓ Every line has a timestamp! Edit any [mm:ss.xx] value for fine-tuning, or clear and begin again.';return;}
    const when = player.currentTime;
    if (next && rows[next-1].start > when) {
      $('vmSyncStatus').textContent='Please play/seek forward beyond the previous line (' + rows[next-1].start.toFixed(1) + ' sec).';return;
    }
    rows[next].start=when;
    $('vmLyrics').value=rows.map(line=>Number.isFinite(line.start)?window.roLyricSync.format(line.start)+' '+line.text:line.text).join('\n');
    lyricDraftVersion++;
    $('vmSyncStatus').textContent='Marked ' + (next+1) + '/' + rows.length + ' lines at ' + when.toFixed(1) + ' sec.' + (next+1===rows.length?' Ready to export!':' Now tap again when the next line starts.');
  });
  $('vmResetLyricMarks').addEventListener('click', () => {
    $('vmLyrics').value=window.roLyricSync.rows(sourceLyricRows().join('\n')).map(row=>row.text).join('\n');
    lyricDraftVersion++;
    $('vmSyncStatus').textContent='Caption timings cleared. Play the song and mark line 1 when singing begins.';
  });
  $('vmSaveSongLyrics').addEventListener('click', async () => {
    if (!selectedSongId) { lyricsInfo('Choose a saved RhymeOrbit song first.'); return; }
    const button = $('vmSaveSongLyrics');
    button.disabled = true;
    try {
      await apiRequest('/api/music/lyrics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: selectedSongId, lyrics: $('vmLyrics').value.slice(0, 8000) })
      });
      lyricsInfo('✓ Edited lyrics saved privately with this song in Cloudflare R2.');
    } catch (error) { lyricsInfo('Lyrics could not be saved: ' + error.message); }
    finally { button.disabled = false; }
  });

  async function refreshSongs() {
    const select = $('vmMySongs');
    select.replaceChildren(new Option('Loading your saved songs…', ''));
    try {
      const data = await (await apiRequest('/api/music/library')).json();
      savedSongs = (data.items || []).filter(song => song.cloudSaved && song.proxyUrl);
      select.replaceChildren(new Option('Select one of your saved songs', ''));
      for (const song of savedSongs) select.add(new Option(song.title || song.id, song.id));
      $('vmSongsStatus').textContent = savedSongs.length > 1
        ? savedSongs.length + ' songs found. Choose a song from the dropdown; we will load lyrics automatically.'
        : savedSongs.length === 1 ? 'One song found. Loading it and checking lyrics now…'
          : 'No archived songs found. You can upload your own MP3/WAV instead.';
      if (savedSongs.length === 1) {select.value = savedSongs[0].id;await loadSavedSong(savedSongs[0]);}
    } catch (error) {
      select.replaceChildren(new Option('Sign in to browse songs', ''));
      $('vmSongsStatus').textContent = error.message;
    }
  }
  $('vmLoadSongs').addEventListener('click', refreshSongs);
  $('vmMySongs').addEventListener('change',()=>{
    const selected = savedSongs.find(item => item.id === $('vmMySongs').value);
    if (selected) loadSavedSong(selected);
  });
  $('vmSelectSong').addEventListener('click', () => {
    const song = savedSongs.find(item => item.id === $('vmMySongs').value);
    if (!song) { status('Choose a saved song first.'); return; }
    loadSavedSong(song);
  });

  function secureName(input) {
    return (input || 'RhymeOrbit').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'RhymeOrbit';
  }

  async function refreshVideos() {
    const library = $('vmVideoLibrary');
    library.textContent = 'Loading private cloud videos…';
    try {
      const data = await (await apiRequest('/api/videos')).json();
      library.replaceChildren();
      if (!data.items?.length) {
        library.textContent = 'No earlier saved videos in R2. New videos are downloaded directly to your device and are not stored here.';
        return;
      }
      for (const video of data.items) {
        const card = document.createElement('div');
        card.className = 'library-item';
        const heading = document.createElement('strong'); heading.textContent = video.title;
        const detail = document.createElement('span'); detail.className = 'tiny';
        detail.textContent = [video.format.toUpperCase(), (video.size / 1048576).toFixed(1) + ' MB', video.duration ? Math.ceil(video.duration) + 's' : '', video.createdAt ? new Date(video.createdAt).toLocaleDateString() : ''].filter(Boolean).join(' · ');
        const row = document.createElement('div'); row.className = 'row';
        const play = document.createElement('button'); play.className = 'btn'; play.textContent = '▶ Play';
        const download = document.createElement('button'); download.className = 'btn gold'; download.textContent = '↓ Download';
        const del = document.createElement('button'); del.className = 'btn'; del.textContent = 'Remove';
        const player = document.createElement('video'); player.controls = true; player.playsInline = true; player.hidden = true;
        async function readVideo() {
          const response = await apiRequest(video.url);
          return response.blob();
        }
        play.onclick = async () => {
          play.disabled = true;
          try {
            if (savedVideoObjectUrl) URL.revokeObjectURL(savedVideoObjectUrl);
            savedVideoObjectUrl = URL.createObjectURL(await readVideo());
            player.src = savedVideoObjectUrl;
            player.hidden = false;
            player.play().catch(() => {});
          } catch (error) { status('Could not load this private video: ' + error.message); }
          finally { play.disabled = false; }
        };
        download.onclick = async () => {
          download.disabled = true;
          try {
            const blob = await readVideo();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = secureName(video.title) + '.' + video.format;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          } catch (error) { status('Download failed: ' + error.message); }
          finally { download.disabled = false; }
        };
        del.onclick = async () => {
          if (!confirm('Delete this video from your private R2 library? This cannot be undone.')) return;
          del.disabled = true;
          try {
            await apiRequest('/api/videos/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: video.id, format: video.format }) });
            await refreshVideos();
          } catch (error) { status('Could not delete video: ' + error.message); del.disabled = false; }
        };
        row.append(play, download, del); card.append(heading, detail, row, player); library.append(card);
      }
    } catch (error) { library.textContent = 'Sign in to view My Videos. ' + error.message; }
  }
  $('vmRefreshVideos').addEventListener('click', refreshVideos);
  $('vmTabVideos').addEventListener('click', refreshVideos);
  if (location.hash === '#videos') { setTab('videos'); refreshVideos(); }
  if (location.hash === '#karaoke') { setTab('music'); $('vmKaraoke').open = true; }
  async function generateLyrics() {
    const idea = $('vmIdea').value.trim();
    if (idea.length < 5) { setTab('lyrics'); status('Describe your idea in at least five characters first.'); $('vmIdea').focus(); return; }
    const button = $('vmGenerateLyrics');
    button.disabled = true;
    status('✦ Writing original lyrics with RhymeOrbit AI…');
    try {
      const token = await aiSessionToken();
      const brief = [
        'Write ORIGINAL short song lyrics for a 50-second animated lyric video.',
        'Language: ' + $('vmLanguage').value,
        'Mood: ' + $('vmLyricMood').value,
        'Story idea: ' + idea.slice(0, 1200),
        'Give 8 to 12 concise singable lines; section labels [Verse] and [Chorus] are optional.',
        'Return only the lyrics, without a title or explanation. No imitation of copyrighted songs.'
      ].join('\n');
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ kind: 'lyrics', input: brief }),
        cache: 'no-store'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.text !== 'string' || !result.text.trim())
        throw Error(result.error || 'Could not generate lyrics. Please try again.');
      const original = result.text.trim().replace(/^```[^\n]*\n?|```$/g, '').trim();
      lyricsBeforeAI = $('vmLyrics').value;
      $('vmLyrics').value = original.slice(0, 8000);
      $('vmUndoLyrics').hidden = false;
      status('✦ AI lyrics are ready! Edit any line, choose a character, and export with or without audio.');
    } catch (error) { status(error.message || 'AI lyrics unavailable right now.'); }
    finally { button.disabled = false; }
  }
  $('vmGenerateLyrics').addEventListener('click', generateLyrics);
  $('vmUndoLyrics').addEventListener('click', () => {
    if (lyricsBeforeAI === null) return;
    $('vmLyrics').value = lyricsBeforeAI;
    lyricsBeforeAI = null;
    $('vmUndoLyrics').hidden = true;
    status('Previous lyrics restored.');
  });

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

  // Lightweight original cartoon mascots, drawn as vectors at export resolution.
  // These are not prompt-to-video AI characters; no GPU provider or licensing cost.
  function drawCharacter(seconds, strength) {
    const choice = $('vmCharacter').value;
    if (choice === 'none') return;
    const w = canvas.width, h = canvas.height;
    const portrait = h > w;
    const size = w * (portrait ? .16 : .085);
    const centerX = w * (portrait ? .5 : .18);
    const centerY = h * (portrait ? .305 : .46);
    const bounce = Math.sin(seconds * 5) * size * (.025 + strength * .065);
    ctx.save();
    ctx.translate(centerX, centerY + bounce);
    ctx.rotate(Math.sin(seconds * 1.7) * .035);
    ctx.shadowColor = '#090713';
    ctx.shadowBlur = size * .2;
    const circle = (x, y, r, color) => {
      ctx.beginPath();ctx.arc(x, y, r, 0, Math.PI * 2);ctx.fillStyle = color;ctx.fill();
    };
    // Each character has a simple dancing body, face and music-reactive eyes.
    ctx.fillStyle = choice === 'robot' ? '#839df2' : choice === 'cat' ? '#d9a7cc' : '#eac5af';
    ctx.beginPath();ctx.ellipse(0, size * .66, size * .56, size * .62, 0, 0, Math.PI * 2);ctx.fill();
    if (choice === 'cat') {
      ctx.fillStyle = '#e8b7de';
      ctx.beginPath();ctx.moveTo(-size * .75,-size * .35);ctx.lineTo(-size * .62,-size * 1.1);ctx.lineTo(-size * .08,-size * .65);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(size * .75,-size * .35);ctx.lineTo(size * .62,-size * 1.1);ctx.lineTo(size * .08,-size * .65);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.ellipse(0,0,size * .78,size * .68,0,0,Math.PI * 2);ctx.fill();
      circle(-size * .28,-size * .05,size * .072,'#30233f');circle(size * .28,-size * .05,size * .072,'#30233f');
      circle(0,size * .14,size * .065,'#ba6a91');
      ctx.strokeStyle = '#795572';ctx.lineWidth = size * .026;
      for (const side of [-1,1])for(let i=-1;i<=1;i++){
        ctx.beginPath();ctx.moveTo(side * size * .35,size * (.19+i*.07));ctx.lineTo(side * size * .88,size * (.13+i*.13));ctx.stroke();
      }
    } else if (choice === 'robot') {
      ctx.fillStyle = '#91b3f5';ctx.beginPath();ctx.roundRect(-size * .72,-size * .65,size * 1.44,size * 1.27,size * .21);ctx.fill();
      ctx.fillStyle = '#21224e';ctx.beginPath();ctx.roundRect(-size * .55,-size * .43,size * 1.1,size * .64,size * .13);ctx.fill();
      const eyePower = .9 + strength * .35;
      circle(-size * .28,-size * .12,size * .12 * eyePower,'#89fff5');circle(size * .28,-size * .12,size * .12 * eyePower,'#89fff5');
      ctx.strokeStyle = '#e6faff';ctx.lineWidth = size * .045;
      ctx.beginPath();ctx.moveTo(-size * .2,size * .37);ctx.lineTo(size * .2,size * .37);ctx.stroke();
      ctx.strokeStyle = '#a0bbf9';ctx.lineWidth = size * .07;
      ctx.beginPath();ctx.moveTo(0,-size * .65);ctx.lineTo(0,-size * .97);ctx.stroke();circle(0,-size * 1.02,size * .105,'#f9b8db');
    } else {
      circle(0,-size * .06,size * .73,'#ebc7ad');
      ctx.fillStyle = '#51395a';ctx.beginPath();ctx.arc(0,-size * .18,size * .74,Math.PI * .98,Math.PI * 1.98);ctx.lineTo(size * .57,-size * .26);ctx.closePath();ctx.fill();
      circle(-size * .25,0,size * .055,'#3d2941');circle(size * .25,0,size * .055,'#3d2941');
      ctx.strokeStyle = '#a15b70';ctx.lineWidth = size * .045;
      ctx.beginPath();ctx.arc(0,size * .14,size * .21,0,Math.PI);ctx.stroke();
      // Small microphone moves with the beat.
      ctx.save();ctx.translate(size * .64,size * .53);ctx.rotate(-.2 + Math.sin(seconds * 4) * .07);
      ctx.strokeStyle='#e9dfef';ctx.lineWidth=size*.085;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-size*.7);ctx.stroke();
      ctx.fillStyle='#6f577e';ctx.beginPath();ctx.ellipse(0,-size*.77,size*.16,size*.23,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f9e3b8';
    ctx.font = '700 ' + Math.round(size * .29) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    const notes = ['♪','♫','✦'];
    ctx.fillText(notes[Math.floor(seconds / 2) % notes.length],size * 1.05,-size * .65 + Math.sin(seconds * 2) * size * .1);
    ctx.restore();
  }

  function lyricLine(seconds, duration) {
    const delay = Number($('vmLyricDelay').value) || 0;
    return window.roLyricSync.at(sourceLyricRows().join('\n'),seconds,duration,delay,audioTitle);
  }
  function drawVideo(second, strength = .2) {
    if (!ctx) return;
    const duration = videoDuration();
    const time = clamp(second, 0, duration - .001);
    const scene = Math.floor(time / SCENE_SECONDS);
    const sceneTime = time - scene * SCENE_SECONDS;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (scene > 0 && sceneTime < 1.1) {
      drawScene((scene - 1) % 5, time, 1);
      drawScene(scene % 5, time, sceneTime / 1.1);
    } else drawScene(scene % 5, time, 1);
    drawCharacter(time, strength);
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
    const words = lyric.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    // Keep captions legible: never squeeze a huge paragraph to one tiny line.
    const shown = lines.slice(0, 3);
    if (lines.length > 3) shown[2] = shown[2].replace(/\s*$/, '') + '…';
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
    ctx.fillText('RHYMEORBIT · ' + String(scene + 1).padStart(2, '0') + ' / ' + String(sceneCount()).padStart(2, '0'), w / 2, h * .93);
    ctx.restore();
  }

  function playbackStrength() {
    if (!analyser || !spectrum) return .2;
    analyser.getByteFrequencyData(spectrum);
    const total = spectrum.slice(0, Math.max(1, Math.floor(spectrum.length / 3)))
      .reduce((sum, n) => sum + n, 0);
    return clamp(total / (Math.max(1, Math.floor(spectrum.length / 3)) * 165), .1, 1);
  }
  function stopPreviewSound() {
    previewAudio?.pause();
    previewAudio = null;
    previewAmbient?.stop();
    previewAmbient = null;
    previewContext?.close().catch(() => {});
    previewContext = null;
    $('vmPreviewSound').textContent = '♫ Hear preview with sound';
    $('vmPreviewSoundStatus').textContent = 'Tap to hear your song or free instrumental';
  }
  async function togglePreviewSound() {
    if (previewAudio || previewAmbient) {stopPreviewSound();return;}
    if ($('vmAudioMode').value === 'silent') {
      $('vmPreviewSoundStatus').textContent = 'Silent mode is selected. Choose song or instrumental to hear audio.';
      return;
    }
    try {
      if (useSelectedSong()) {
        const player = new Audio(audioUrl);
        player.loop = true;
        await player.play();
        previewAudio = player;
      } else {
        if (!window.roCreativeAudio?.createAmbientMusic) throw Error('Free music synthesizer unavailable. Refresh the page.');
        previewContext = new AudioContext();
        await previewContext.resume();
        previewAmbient = window.roCreativeAudio.createAmbientMusic(previewContext,previewContext.destination,{mood:$('vmMusicMood').value});
      }
      previewStarted = performance.now();
      $('vmPreviewSound').textContent = '🔇 Mute preview';
      $('vmPreviewSoundStatus').textContent = previewAudio ? 'Playing your selected song' : 'Playing free original instrumental';
    } catch (error) {stopPreviewSound();$('vmPreviewSoundStatus').textContent = 'Sound could not start: ' + (error.message || 'browser blocked audio');}
  }
  $('vmPreviewSound').addEventListener('click',togglePreviewSound);
  $('vmAudioMode').addEventListener('change',stopPreviewSound);
  $('vmMusicMood').addEventListener('change',stopPreviewSound);
  function drawLoop() {
    if (exporting) {
      const seconds = exportAudio ? exportAudio.currentTime : (performance.now() - exportStartedAt) / 1000;
      drawVideo(Math.min(exportTarget - .001, seconds), playbackStrength());
    } else if (!document.hidden) {
      const seconds = previewAudio ? previewAudio.currentTime : ((performance.now() - previewStarted) / 1000) % videoDuration();
      drawVideo(seconds, .32);
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
  function supportedMime(hasAudio) {
    if (!window.MediaRecorder) return '';
    // Never label a WebM as MP4: record MP4 only when the browser supports a
    // real MP4 container and compatible codecs, otherwise use a valid WebM.
    // Prefer the widely supported WebM + Opus pair to avoid silent MP4 exports
    // on browsers that claim generic MP4 support without an audio encoder.
    const withAudio = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'];
    const silent = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8'];
    return [...(hasAudio ? withAudio : silent), 'video/webm']
      .find(type => MediaRecorder.isTypeSupported(type)) || '';
  }
  function cleanupExport() {
    exporting = false;
    $('vmExport').disabled = false;
    $('vmStop').disabled = true;
    exportAudio?.pause();
    exportAmbient?.stop();
    exportStream?.getTracks().forEach(track => track.stop());
    exportContext?.close().catch(() => {});
    exportAudio = null;
    exportAmbient = null;
    exportContext = null;
    exportStream = null;
    analyser = null;
    spectrum = null;
    recorder = null;
  }
  async function exportVideo() {
    if (exporting) return;
    stopPreviewSound();
    const hasSongAudio = useSelectedSong();
    const hasAmbientAudio = !hasSongAudio && $('vmAudioMode').value !== 'silent';
    const hasAudio = hasSongAudio || hasAmbientAudio;
    if (!hasSongAudio && !$('vmLyrics').value.trim()) {
      setTab('lyrics'); status('Add or generate some lyrics first, or choose a song.'); return;
    }
    const captions=window.roLyricSync.rows(sourceLyricRows().join('\n'));
    if (hasSongAudio && captions.length > 1 && !window.roLyricSync.isTimed(captions)) {
      if (!confirm('Your captions have no complete timestamps. Auto-spaced lyrics may NOT match the sung words in your downloaded video. Open Lyrics → Sync first?')) {
        setTab('lyrics');status('Sync each line with the song in Lyrics before exporting.');return;
      }
    }
    if (!$('vmRights').checked) { status('Confirm you own or are allowed to use the song and lyrics.'); return; }
    if (!ctx || !canvas.captureStream || !window.MediaRecorder || (hasAudio && !window.AudioContext)) {
      status('This browser cannot export this video. Try updated desktop Chrome or Edge.');
      return;
    }
    const mime = supportedMime(hasAudio);
    if (!mime) { status('Video export is not supported in this browser. Try updated Chrome or Edge.'); return; }
    $('vmExport').disabled = true;
    $('vmStop').disabled = false;
    $('vmDownloadResult').hidden = true;
    $('vmProgress').value = 0;
    exportTarget = videoDuration();
    $('vmProgress').max = exportTarget;
    status('Preparing ' + sceneCount() + ' animated scenes (' + Math.ceil(exportTarget) + ' sec)… keep this page visible.');
    let failed = false;
    try {
      exportStream = canvas.captureStream(24);
      if (hasSongAudio) {
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
        // Also monitor locally while recording so people can hear their song.
        analyser.connect(exportContext.destination);
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (!audioTrack) throw Error('Browser audio capture is unavailable.');
        exportStream.addTrack(audioTrack);
      } else if (hasAmbientAudio) {
        if (!window.roCreativeAudio?.createAmbientMusic) throw Error('Free music synthesizer did not load. Please refresh.');
        exportContext = new AudioContext();
        await exportContext.resume();
        const dest = exportContext.createMediaStreamDestination();
        const monitor = exportContext.createGain();
        monitor.gain.value = .75;
        exportAmbient = window.roCreativeAudio.createAmbientMusic(exportContext, monitor,{mood:$('vmMusicMood').value});
        monitor.connect(dest);
        monitor.connect(exportContext.destination);
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (!audioTrack) throw Error('Instrumental audio capture is unavailable.');
        exportStream.addTrack(audioTrack);
      }
      const chunks = [];
      // Limit browser memory and the user's eventual download size.
      const targetBitsPerSecond = Math.floor(37 * 1024 * 1024 * 8 / exportTarget);
      const videoBitRate = clamp(targetBitsPerSecond - (hasAudio ? 160000 : 0), 540000, 2600000);
      recorder = new MediaRecorder(exportStream, {
        mimeType: mime, videoBitsPerSecond: videoBitRate, audioBitsPerSecond: 160000
      });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const actualMime = recorder?.mimeType || mime;
        cleanupExport();
        if (failed) return;
        if (!chunks.length) { status('No video was captured. Try again in desktop Chrome or Edge.'); return; }
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        const blob = new Blob(chunks, { type: actualMime });
        downloadUrl = URL.createObjectURL(blob);
        const ext = actualMime.includes('mp4') ? 'mp4' : 'webm';
        const name = secureName(audioTitle || sourceName || 'RhymeOrbit');
        const link = $('vmDownloadLink');
        link.href = downloadUrl;
        link.download = (name || 'RhymeOrbit') + '-' + Math.round(exportTarget) + 's-video.' + ext;
        link.textContent = '↓ Download ' + ext.toUpperCase() + ' video';
        $('vmFormatNote').textContent = 'Export completed locally · ' + (blob.size / 1048576).toFixed(1) + ' MB. Format: ' + ext.toUpperCase() + (ext === 'webm' ? ' (this browser did not support MP4 recording).' : '.');
        $('vmDownloadResult').hidden = false;
        status('Your animated video is ready. Download it now: this file is not saved on our servers.');
        const popup = $('vmLocalNotice');
        if (popup && typeof popup.showModal === 'function' && !popup.open)popup.showModal();
      };
      recorder.onerror = () => { status('Browser video recorder failed.'); };
      exporting = true;
      exportStartedAt = performance.now();
      drawVideo(0, .3);
      recorder.start(750);
      if (hasSongAudio) await exportAudio.play();
      else exportStartedAt = performance.now();
      status('Recording ' + sceneCount() + ' scenes ' + (hasSongAudio ? 'with your song' : hasAmbientAudio ? 'with free instrumental music' : 'silently') + '…');
      const progressTimer = setInterval(() => {
        if (!exporting) { clearInterval(progressTimer); return; }
        const value = Math.min(exportTarget, exportAudio ? exportAudio.currentTime : (performance.now() - exportStartedAt) / 1000);
        $('vmProgress').value = value;
        $('vmProgressLabel').textContent = value.toFixed(0) + ' / ' + exportTarget.toFixed(0) + ' seconds encoded';
        if (value >= exportTarget - .08 || exportAudio?.ended) {
          clearInterval(progressTimer);
          if (recorder?.state === 'recording') recorder.stop();
        }
      }, 120);
    } catch (error) {
      failed = true;
      if (recorder?.state === 'recording') recorder.stop();
      else cleanupExport();
      status((error?.message || 'Video export could not start.') + ' Try a smaller MP3/WAV or updated desktop Chrome.');
    }
  }
  $('vmExport').addEventListener('click', exportVideo);
  $('vmNoticeDownload').addEventListener('click',()=>{$('vmLocalNotice').close();$('vmDownloadLink').click();});
  $('vmNoticeOk').addEventListener('click',()=>$('vmLocalNotice').close());
  $('vmStop').addEventListener('click', () => {
    if (recorder?.state === 'recording') recorder.stop();
    status('Export stopped. Any captured portion will still be available to download.');
  });
  window.addEventListener('pagehide', () => {
    stopPreviewSound();
    exportAudio?.pause();
    exportStream?.getTracks().forEach(track => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    if (savedVideoObjectUrl) URL.revokeObjectURL(savedVideoObjectUrl);
  });
})();
