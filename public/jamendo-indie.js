/* Optional independent-artist listening inside the existing Listen & Chill tab.
   This does not expose credentials or enable Jamendo when licensing is pending. */
(function () {
  'use strict';
  const originalMount = window.roCcMount;
  let statusRequest = null;
  let statusLoaded = false;
  let available = false;
  let searchCount = 0;
  let searchAbort = null;
  let moreOffset = 0;
  let moreQuery = '';
  const batchSize = 6;
  let cachedTracks = [];
  let shownCount = 0;
  let indieLoaded = false;
  let indianRequest = 0;
  let indianAbort = null;
  let indianTracks = [];
  let indianShown = 0;
  const indianPageSize = 8;
  const indianFolders = [
    {id:'hindi',label:'🎵 Hindi picks',query:'Hindi song'},
    {id:'trending',label:'🔥 Trending worldwide',query:''},
    {id:'played',label:'🏆 Most played',query:'Hindi song'},
    {id:'new',label:'🆕 New uploads',query:'Hindi song'},
    {id:'romantic',label:'💗 Romantic',query:'Hindi romantic'},
    {id:'devotional',label:'🙏 Devotional',query:'Hindi bhajan'},
    {id:'punjabi',label:'⚡ Punjabi',query:'Punjabi song'},
    {id:'haryanvi',label:'🌾 Haryanvi',query:'Haryanvi song'},
    {id:'bhojpuri',label:'🎉 Bhojpuri',query:'Bhojpuri song'}
  ];

  function checkedHttps(url, host) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' &&
        (parsed.hostname === host || parsed.hostname.endsWith('.' + host)) ? parsed.href : null;
    } catch { return null; }
  }

  function songCard(item) {
    const card = document.createElement('article');
    card.className = 'ro-cc-tile';
    const art = document.createElement('div');
    art.className = 'ro-cc-art';
    const cover = checkedHttps(item.cover, 'usercontent.jamendo.com');
    if (cover) {
      const image = document.createElement('img');
      image.src = cover;
      image.alt = '';
      image.loading = 'lazy';
      image.style.cssText = 'width:100%;height:100%;object-fit:cover';
      art.append(image);
    } else art.textContent = '🎶';

    const body = document.createElement('div');
    body.className = 'ro-cc-tile-body';
    const title = document.createElement('h4');
    title.textContent = String(item.title || 'Independent track');
    const artist = document.createElement('p');
    artist.className = 'muted small';
    artist.textContent = String(item.artist || 'Independent artist');
    body.append(title, artist);

    const audio = checkedHttps(item.audio, 'storage.jamendo.com');
    if (audio) {
      const player = document.createElement('audio');
      player.src = audio;
      player.controls = true;
      player.preload = 'none';
      player.setAttribute('aria-label', 'Play ' + title.textContent);
      player.style.cssText = 'width:100%;max-width:100%';
      player.addEventListener('play', () => {
        document.querySelectorAll('#roJamendoResults audio').forEach(other => {
          if (other !== player) other.pause();
        });
      });
      body.append(player);
    }

    const credits = document.createElement('p');
    credits.className = 'ro-cc-credit';
    credits.textContent = 'Music © ' + artist.textContent + ' · ';
    const trackUrl = checkedHttps(item.source, 'jamendo.com');
    if (trackUrl) {
      const source = document.createElement('a');
      source.href = trackUrl;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = 'Jamendo track';
      credits.append(source);
    }
    const licenseUrl = checkedHttps(item.license, 'creativecommons.org');
    if (licenseUrl) {
      const license = document.createElement('a');
      license.href = licenseUrl;
      license.target = '_blank';
      license.rel = 'noopener noreferrer';
      license.textContent = ' · License';
      credits.append(license);
    }
    body.append(credits);
    card.append(art, body);
    return card;
  }

  function showNextSongs() {
    const result = document.getElementById('roJamendoResults');
    const info = document.getElementById('roJamendoStatus');
    const more = document.getElementById('roJamendoMore');
    if (!result || !info) return;
    const next = cachedTracks.slice(shownCount, shownCount + batchSize);
    result.append(...next.map(songCard));
    shownCount += next.length;
    const remaining = cachedTracks.length - shownCount;
    info.textContent = shownCount
      ? `${shownCount} songs ready to play${remaining || moreOffset ? ' · More songs available below' : ''}.`
      : 'No matching indie music here. Try Rock, Piano or Acoustic, or switch to Music Videos.';
    if (more) {
      more.hidden = !remaining && !moreOffset;
      more.textContent = remaining
        ? `Show ${Math.min(batchSize, remaining)} more songs ↓`
        : 'Load more songs ↓';
    }
  }

  function selectSource(mode) {
    const music = mode === 'music';
    const videos = mode === 'videos';
    const catalog = document.getElementById('roJamendoSection');
    const indianCatalog = document.getElementById('roIndianCatalogSection');
    const videoStatus = document.getElementById('roYtStatus');
    const videoGrid = document.getElementById('roYtGrid');
    const videoPlayer = document.getElementById('roYtPlayer');
    if (catalog) catalog.hidden = !music;
    if (indianCatalog) indianCatalog.hidden = mode !== 'indian';
    for (const element of [videoStatus, videoGrid, videoPlayer]) {
      if (element) element.style.display = videos ? '' : 'none';
    }
    const videoFolders=document.getElementById('roVideoFolders');
    if(videoFolders)videoFolders.hidden=!videos;
    if (!videos) videoPlayer?.replaceChildren();
    if (!music) document.querySelectorAll('#roJamendoResults audio').forEach(audio => audio.pause());
    if (mode !== 'indian') document.querySelectorAll('#roIndianCatalogResults audio').forEach(audio => audio.pause());
    document.querySelectorAll('#roListenSourceModes button').forEach(button => {
      const active = button.dataset.source === mode;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('gold', active);
    });
    if (mode === 'indian') {
      const section = document.getElementById('roIndianCatalogSection');
      if (!section?.dataset.searched) searchIndianCatalog('Hindi song','hindi');
    }
    if (mode==='music' && available && !indieLoaded) {indieLoaded=true;searchJamendo('rock');}
    if (videos && videoGrid && !videoGrid.children.length) window.roYtShowFeatured?.();
    const search = document.getElementById('roYtQuery');
    if (search) {
      search.placeholder = mode==='indian'?'Search a song, artist or language…':mode==='videos'?'Search music videos…':'Search independent tracks…';
      search.setAttribute('aria-label',mode==='indian'?'Search Audius songs':mode==='videos'?'Search YouTube music videos':'Search independent music');
    }
  }

  function installSourceModes() {
    const status = document.getElementById('roYtStatus');
    if (!status || document.getElementById('roListenSourceModes')) return;
    const modes = document.createElement('div');
    modes.id = 'roListenSourceModes';
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Choose what to listen to');
    modes.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 16px';
    const options = [
      ...(available ? [['music', '♫ Listen to Music']] : []),
      ['indian', '🇮🇳 Hindi & More · Audius'],
      ['videos', '▶ Watch Music Videos']
    ];
    for (const [source, label] of options) {
      const button = document.createElement('button');
      button.className = 'btn sm';
      button.type = 'button';
      button.dataset.source = source;
      button.textContent = label;
      button.addEventListener('click', () => selectSource(source));
      modes.append(button);
    }
    // Source choice comes first; show source-specific folders beneath it.
    status.parentNode.insertBefore(modes, document.getElementById('roVideoFolders') || status);
    selectSource('indian');
  }

  function installIndianCatalog() {
    const videoGrid = document.getElementById('roYtGrid');
    if (!videoGrid || document.getElementById('roIndianCatalogSection')) return;
    const section = document.createElement('section');
    section.id = 'roIndianCatalogSection';
    section.hidden = true;
    section.className = 'ro-indian-lounge';
    const heading = document.createElement('h3');
    heading.textContent = '🎧 Explore Songs';
    const description = document.createElement('p');
    description.className = 'muted small';
    description.textContent = 'Free community audio from Audius · independent tracks and covers, not a verified Bollywood catalog.';
    const folders = document.createElement('div');
    folders.id = 'roIndianFolders';folders.className = 'ro-indian-folders';
    folders.setAttribute('role','group');folders.setAttribute('aria-label','Browse music collections');
    for (const folder of indianFolders) {
      const button = document.createElement('button');
      button.type = 'button';button.className = 'ro-indian-folder';button.dataset.folder = folder.id;
      button.textContent = folder.label;
      button.setAttribute('aria-pressed',String(folder.id==='hindi'));
      button.addEventListener('click',()=>{
        const input=document.getElementById('roYtQuery');
        if(input)input.value=folder.query;
        searchIndianCatalog(folder.query,folder.id);
      });
      folders.append(button);
    }
    const status = document.createElement('p');
    status.id = 'roIndianCatalogStatus';
    status.className = 'muted small';
    status.setAttribute('role', 'status');
    status.textContent = 'Choose a collection or search above.';
    const results = document.createElement('div');
    results.id = 'roIndianCatalogResults';
    results.className = 'ro-cc-grid ro-indian-results';
    const more = document.createElement('button');
    more.id = 'roIndianMore';more.className = 'btn sm';more.type = 'button';
    more.textContent = 'Show more songs ↓';more.hidden = true;
    more.addEventListener('click',showNextIndianSongs);
    section.append(heading, description, folders, status, results, more);
    videoGrid.parentNode.insertBefore(section, videoGrid);
  }

  function normalizePublicAudiusTrack(track) {
    if (!track || track.is_available !== true || track.is_streamable !== true) return null;
    const id = typeof track.id === 'string' ? track.id : '';
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
    const released = Date.parse(track.release_date || track.created_at || '');
    const artwork = track.artwork?.['480x480'];
    const permalink = typeof track.permalink === 'string' && /^\/[a-zA-Z0-9_/-]+$/.test(track.permalink) ? track.permalink : '';
    return {
      id,
      title: String(track.title || 'Community song').slice(0, 140),
      artist: String(track.user?.name || track.user?.handle || 'Audius creator').slice(0, 140),
      audio: 'https://api.audius.co/v1/tracks/' + encodeURIComponent(id) + '/stream',
      source: permalink ? 'https://audius.co' + permalink : '',
      cover: checkedHttps(artwork, 'figment.io') || checkedHttps(artwork, 'audius.co'),
      playCount: Number.isFinite(Number(track.play_count)) ? Math.max(0, Number(track.play_count)) : null,
      releaseAt: Number.isFinite(released) && released > 0 ? released : 0
    };
  }

  async function getAudiusTracks(query, signal, trending = false) {
    const directUrl = trending
      ? 'https://api.audius.co/v1/tracks/trending?time=week&limit=30'
      : 'https://api.audius.co/v1/tracks/search?query=' + encodeURIComponent(query) + '&limit=40';
    // Audius explicitly supports public read-only browser access. Its CORS
    // endpoint is useful when an edge-hosted backend gets blocked upstream.
    try {
      const direct = await fetch(directUrl, { signal, cache: 'no-store' });
      if (!direct.ok) throw Error('Audius direct search unavailable');
      const data = await direct.json();
      if (!Array.isArray(data?.data)) throw Error('Unexpected Audius response');
      return data.data.map(normalizePublicAudiusTrack).filter(Boolean);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      if (trending) throw error;
      const response = await fetch('/api/catalog/audius/search?q=' + encodeURIComponent(query), {
        signal, cache: 'no-store'
      });
      if (!response.ok) throw Error('Audius search unavailable');
      const data = await response.json();
      return Array.isArray(data.tracks) ? data.tracks.slice(0, 20) : [];
    }
  }

  function showNextIndianSongs() {
    const results = document.getElementById('roIndianCatalogResults');
    const more = document.getElementById('roIndianMore');
    if (!results || !more) return;
    for (const track of indianTracks.slice(indianShown, indianShown + indianPageSize)) {
      const tile = document.createElement('article');tile.className = 'ro-cc-tile ro-indian-tile';
      const cover = document.createElement('div');cover.className = 'ro-indian-art';
      if (track.cover) {
        const image=document.createElement('img');image.src=track.cover;image.alt='';image.loading='lazy';
        image.referrerPolicy='no-referrer';
        image.addEventListener('error',()=>{image.remove();cover.textContent='♫';});
        cover.append(image);
      } else cover.textContent='♫';
      const body = document.createElement('div');body.className='ro-cc-tile-body';
      const title = document.createElement('h4');title.textContent=track.title;
      const artist = document.createElement('p');artist.className='muted small';artist.textContent=track.artist;
      const meta = document.createElement('p');meta.className='ro-indian-meta';
      const info=[];
      if (Number.isFinite(track.playCount)) info.push(new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(track.playCount)+' plays');
      if (track.releaseAt) info.push(new Date(track.releaseAt).toLocaleDateString('en-IN',{month:'short',year:'numeric'}));
      meta.textContent=info.join(' · ') || 'Audius community';
      body.append(title,artist,meta);
      const audioUrl=checkedHttps(track.audio,'api.audius.co');
      if (audioUrl) {
        const player=document.createElement('audio');player.src=audioUrl;player.controls=true;player.preload='none';
        player.setAttribute('aria-label','Play '+track.title+' by '+track.artist);
        player.addEventListener('play',()=>{
          document.querySelectorAll('#roIndianCatalogResults audio, #roJamendoResults audio').forEach(other=>{
            if(other!==player)other.pause();
          });
        });
        body.append(player);
      }
      const original=checkedHttps(track.source,'audius.co');
      if(original && new URL(original).pathname!=='/'){const source=document.createElement('a');source.href=original;source.target='_blank';source.rel='noopener noreferrer';source.textContent='On Audius ↗';source.className='ro-indian-source';body.append(source);}
      tile.append(cover,body);results.append(tile);
    }
    indianShown=Math.min(indianTracks.length,indianShown+indianPageSize);
    more.hidden=indianShown>=indianTracks.length;
    more.textContent='Show more songs · '+(indianTracks.length-indianShown)+' left ↓';
  }

  async function searchIndianCatalog(query,folderId='search') {
    const status = document.getElementById('roIndianCatalogStatus');
    const results = document.getElementById('roIndianCatalogResults');
    const section = document.getElementById('roIndianCatalogSection');
    if (!status || !results) return;
    const trending=folderId==='trending';
    if (!trending && (query.length < 2 || query.length > 80)) {
      status.textContent = 'Enter a song or artist name between 2 and 80 characters.';
      return;
    }
    const request = ++indianRequest;
    indianAbort?.abort();
    indianAbort = new AbortController();
    section.dataset.searched = 'yes';
    results.replaceChildren();
    const more=document.getElementById('roIndianMore');if(more)more.hidden=true;
    indianTracks=[];indianShown=0;
    document.querySelectorAll('#roIndianFolders button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.folder===folderId)));
    status.textContent = 'Loading songs…';
    try {
      const tracks = await getAudiusTracks(query, indianAbort.signal, trending);
      if (request !== indianRequest || !document.getElementById('roIndianCatalogResults')) return;
      const seen=new Set();
      indianTracks=tracks.filter(track=>{
        if(!/^[A-Za-z0-9_-]{1,80}$/.test(track.id||'')||!checkedHttps(track.audio,'api.audius.co')||seen.has(track.id))return false;
        seen.add(track.id);return true;
      });
      if(folderId==='played')indianTracks.sort((a,b)=>(b.playCount||0)-(a.playCount||0));
      if(folderId==='new')indianTracks.sort((a,b)=>(b.releaseAt||0)-(a.releaseAt||0));
      status.textContent=!indianTracks.length?'No playable matches. Try another collection.':
        folderId==='trending'?`${indianTracks.length} trending on Audius worldwide this week · not Hindi-only.`:
        folderId==='played'?`${indianTracks.length} Hindi search matches · sorted by Audius play count.`:
        folderId==='new'?`${indianTracks.length} Hindi search matches · newest Audius uploads first.`:
        `${indianTracks.length} playable community tracks · covers and independent music.`;
      showNextIndianSongs();
    } catch (error) {
      if (error.name === 'AbortError' || request !== indianRequest) return;
      status.textContent = 'Audius search is not responding right now. Try again later or use Music Videos.';
    }
  }

  async function searchJamendo(query, append = false) {
    const result = document.getElementById('roJamendoResults');
    const info = document.getElementById('roJamendoStatus');
    const more = document.getElementById('roJamendoMore');
    if (!result || !info || query.length < 2) return;
    if (append && moreQuery !== query) return;
    if (append && shownCount < cachedTracks.length) {
      showNextSongs();
      return;
    }
    if (append && !moreOffset) return;
    const current = ++searchCount;
    searchAbort?.abort();
    searchAbort = new AbortController();
    const offset = append ? moreOffset : 0;
    info.textContent = append ? 'Loading more indie songs…' : 'Finding independent artists…';
    if (more) more.hidden = true;
    if (!append) {
      result.replaceChildren();
      cachedTracks = [];
      shownCount = 0;
      moreOffset = 0;
    }
    try {
      const response = await fetch('/api/jamendo/search?q=' + encodeURIComponent(query) + '&offset=' + offset, {
        signal: searchAbort.signal
      });
      const data = await response.json();
      if (current !== searchCount || !document.getElementById('roJamendoResults')) return;
      if (!response.ok) throw Error(data.error || 'Jamendo unavailable');
      const items = Array.isArray(data.items) ? data.items : [];
      cachedTracks.push(...items);
      moreOffset = items.length && data.hasMore ? Number(data.nextOffset) : 0;
      moreQuery = query;
      showNextSongs();
    } catch (error) {
      if (error.name === 'AbortError' || current !== searchCount) return;
      info.textContent = 'Independent catalog unavailable for now. You can still use the other music players.';
      if (more) more.hidden = !append;
    }
  }

  function showCatalog() {
    const form = document.getElementById('roYtForm');
    const mainResults = document.getElementById('roYtGrid');
    if (!form || !mainResults) return;
    if (available && !document.getElementById('roJamendoSection')) {
      indieLoaded=false;
      const section = document.createElement('section');
      section.id = 'roJamendoSection';
      section.style.cssText = 'margin-top:24px;padding-top:20px;border-top:1px solid #ffffff30';
      const heading = document.createElement('h3');
      heading.textContent = '🎧 Indie music · Jamendo';
      const explanation = document.createElement('p');
      explanation.className = 'muted small';
      explanation.textContent = 'These songs are playable right here. Try a genre or search above. This independent catalog does not include every Bollywood hit and is not a karaoke or download library.';
      const genres = document.createElement('div');
      genres.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:12px 0';
      [['🎸 Rock', 'rock'], ['🎹 Piano', 'piano'], ['🌿 Acoustic', 'acoustic']].forEach(([label, query]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn sm';
        button.textContent = label;
        button.addEventListener('click', () => {
          const input = document.getElementById('roYtQuery');
          if (input) input.value = query;
          searchJamendo(query);
        });
        genres.append(button);
      });
      const info = document.createElement('p');
      info.id = 'roJamendoStatus';
      info.className = 'muted small';
      info.setAttribute('role', 'status');
      info.textContent = 'Loading a few songs to try…';
      const results = document.createElement('div');
      results.id = 'roJamendoResults';
      results.className = 'ro-cc-grid';
      const more = document.createElement('button');
      more.id = 'roJamendoMore';
      more.className = 'btn sm';
      more.type = 'button';
      more.textContent = 'Show more songs ↓';
      more.style.cssText = 'margin:18px auto 8px';
      more.hidden = true;
      more.addEventListener('click', () => searchJamendo(moreQuery, true));
      section.append(heading, explanation, genres, info, results, more);
      // Keep real, playable songs close to the search instead of hiding them
      // below the discovery results on a long page.
      mainResults.parentNode.insertBefore(section, mainResults);
    }
    installIndianCatalog();
    installSourceModes();
    if (form.dataset.jamendoConnected !== 'yes') {
      form.dataset.jamendoConnected = 'yes';
      form.addEventListener('submit', event => {
        const query = document.getElementById('roYtQuery')?.value.trim();
        const mode = document.querySelector('#roListenSourceModes button[aria-pressed="true"]')?.dataset.source;
        if (mode !== 'indian' && mode !== 'music') return;
        // Audio modes search audio only; do not run a redundant YouTube API call.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!query || query.length < 2) return;
        if (mode === 'indian') searchIndianCatalog(query);
        else searchJamendo(query);
      }, { capture: true });
    }
  }

  window.roCcMount = function () {
    if (typeof originalMount === 'function') originalMount();
    if (statusLoaded) { showCatalog(); return; }
    if (!statusRequest) {
      statusRequest = fetch('/api/jamendo/status', { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(data => { available = data?.publicCatalogEnabled === true; })
        .catch(() => {})
        .finally(() => { statusLoaded = true; showCatalog(); });
    }
  };

  // A direct visit to #listen can render before this script loads. Mount the
  // catalog once the document is ready, even when the visitor never clicks a tab.
  const mountOnDirectVisit = () => {
    if (document.getElementById('roYtForm')) window.roCcMount();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountOnDirectVisit, { once: true });
  } else {
    mountOnDirectVisit();
  }
})();
