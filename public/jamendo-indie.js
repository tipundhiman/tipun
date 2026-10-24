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
  let indianRequest = 0;
  let indianAbort = null;

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
    if (!videos) videoPlayer?.replaceChildren();
    if (!music) document.querySelectorAll('#roJamendoResults audio').forEach(audio => audio.pause());
    document.querySelectorAll('#roListenSourceModes button').forEach(button => {
      const active = button.dataset.source === mode;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('gold', active);
    });
    if (mode === 'indian') {
      const query = document.getElementById('roYtQuery')?.value.trim() || '';
      const section = document.getElementById('roIndianCatalogSection');
      if (query.length >= 2 && !section?.dataset.searched) searchIndianCatalog(query);
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
      ['indian', '🇮🇳 Indian Songs · Beta'],
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
    status.parentNode.insertBefore(modes, status);
    selectSource(available ? 'music' : 'videos');
  }

  function installIndianCatalog() {
    const videoGrid = document.getElementById('roYtGrid');
    if (!videoGrid || document.getElementById('roIndianCatalogSection')) return;
    const section = document.createElement('section');
    section.id = 'roIndianCatalogSection';
    section.hidden = true;
    section.style.cssText = 'margin-top:16px;padding:18px;border:1px solid #ffffff30;border-radius:18px;background:#ffffff06';
    const heading = document.createElement('h3');
    heading.textContent = '🇮🇳 Indian Song Discovery · Beta';
    const description = document.createElement('p');
    description.className = 'muted small';
    description.textContent = 'Test Indian song discovery using the search box above. Catalog results depend on the source. Full audio playback is not enabled until verified; music videos remain available in the next tab.';
    const sample = document.createElement('button');
    sample.type = 'button';
    sample.className = 'btn sm';
    sample.textContent = 'Try searching Kesariya ↗';
    sample.addEventListener('click', () => {
      const input = document.getElementById('roYtQuery');
      if (input) input.value = 'Kesariya';
      searchIndianCatalog('Kesariya');
    });
    const status = document.createElement('p');
    status.id = 'roIndianCatalogStatus';
    status.className = 'muted small';
    status.setAttribute('role', 'status');
    status.textContent = 'Type a song or artist above and tap Let’s Jam, or try the example.';
    const results = document.createElement('div');
    results.id = 'roIndianCatalogResults';
    results.className = 'ro-cc-grid';
    const watch = document.createElement('button');
    watch.className = 'btn sm';
    watch.type = 'button';
    watch.textContent = '▶ Explore Music Videos instead';
    watch.addEventListener('click', () => selectSource('videos'));
    section.append(heading, description, sample, status, results, watch);
    videoGrid.parentNode.insertBefore(section, videoGrid);
  }

  async function searchIndianCatalog(query) {
    const status = document.getElementById('roIndianCatalogStatus');
    const results = document.getElementById('roIndianCatalogResults');
    const section = document.getElementById('roIndianCatalogSection');
    if (!status || !results) return;
    if (query.length < 2 || query.length > 80) {
      status.textContent = 'Enter a song or artist name between 2 and 80 characters.';
      return;
    }
    const request = ++indianRequest;
    indianAbort?.abort();
    indianAbort = new AbortController();
    section.dataset.searched = 'yes';
    results.replaceChildren();
    status.textContent = 'Searching the Indian catalog…';
    try {
      const response = await fetch('/api/catalog/gaana/search?q=' + encodeURIComponent(query), {
        signal: indianAbort.signal,
        cache: 'no-store'
      });
      const data = await response.json();
      if (request !== indianRequest || !document.getElementById('roIndianCatalogResults')) return;
      if (!response.ok) {
        status.textContent = 'Indian catalog is temporarily unavailable. The Music Videos tab still lets you search and watch supported videos here.';
        return;
      }
      const tracks = Array.isArray(data.tracks) ? data.tracks.slice(0, 8) : [];
      status.textContent = tracks.length ? `${tracks.length} matching song titles found. Select a title to explore its music video.` : 'No Indian catalog matches yet. Try a different title or Music Videos.';
      for (const track of tracks) {
        const tile = document.createElement('article');
        tile.className = 'ro-cc-tile';
        const body = document.createElement('div');
        body.className = 'ro-cc-tile-body';
        const title = document.createElement('h4');
        title.textContent = String(track.title || 'Song');
        const artist = document.createElement('p');
        artist.className = 'muted small';
        artist.textContent = String(track.artist || 'Indian catalog');
        const watch = document.createElement('button');
        watch.type = 'button';
        watch.className = 'btn sm';
        watch.textContent = '▶ Find music video';
        watch.addEventListener('click', () => {
          const input = document.getElementById('roYtQuery');
          if (input) input.value = [track.title, track.artist].filter(Boolean).join(' ');
          selectSource('videos');
          window.roYtSearch?.({ preventDefault() {} });
        });
        body.append(title, artist, watch);
        const original = checkedHttps(track.url, 'gaana.com');
        if (original) {
          const source = document.createElement('a');
          source.className = 'muted small';
          source.href = original;
          source.target = '_blank';
          source.rel = 'noopener noreferrer';
          source.textContent = ' · Original song page ↗';
          body.append(source);
        }
        tile.append(body);
        results.append(tile);
      }
    } catch (error) {
      if (error.name === 'AbortError' || request !== indianRequest) return;
      status.textContent = 'Song search is not responding right now. Try Music Videos or the independent music tab.';
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
      searchJamendo('rock');
    }
    installIndianCatalog();
    installSourceModes();
    if (form.dataset.jamendoConnected !== 'yes') {
      form.dataset.jamendoConnected = 'yes';
      form.addEventListener('submit', () => {
        const query = document.getElementById('roYtQuery')?.value.trim();
        if (query?.length < 2) return;
        const mode = document.querySelector('#roListenSourceModes button[aria-pressed="true"]')?.dataset.source;
        if (mode === 'music') searchJamendo(query);
        if (mode === 'indian') searchIndianCatalog(query);
      });
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
