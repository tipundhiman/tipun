/* Optional independent-artist listening inside the existing Listen & Chill tab.
   This does not expose credentials or enable Jamendo when licensing is pending. */
(function () {
  'use strict';
  const originalMount = window.roCcMount;
  let statusRequest = null;
  let available = false;
  let searchCount = 0;
  let searchAbort = null;

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

  async function searchJamendo(query) {
    const result = document.getElementById('roJamendoResults');
    const info = document.getElementById('roJamendoStatus');
    if (!result || !info || query.length < 2) return;
    const current = ++searchCount;
    searchAbort?.abort();
    searchAbort = new AbortController();
    info.textContent = 'Finding independent artists…';
    result.replaceChildren();
    try {
      const response = await fetch('/api/jamendo/search?q=' + encodeURIComponent(query), {
        signal: searchAbort.signal
      });
      const data = await response.json();
      if (current !== searchCount || !document.getElementById('roJamendoResults')) return;
      if (!response.ok) throw Error(data.error || 'Jamendo unavailable');
      const items = Array.isArray(data.items) ? data.items : [];
      info.textContent = items.length ? items.length + ' independent tracks found.' : 'No independent tracks matched. Try another artist or genre.';
      result.replaceChildren(...items.map(songCard));
    } catch (error) {
      if (error.name === 'AbortError' || current !== searchCount) return;
      info.textContent = 'Independent catalog unavailable for now. You can still use the other music players.';
    }
  }

  function showCatalog() {
    if (!available) return;
    const form = document.getElementById('roYtForm');
    const mainResults = document.getElementById('roYtGrid');
    if (!form || !mainResults) return;
    if (!document.getElementById('roJamendoSection')) {
      const section = document.createElement('section');
      section.id = 'roJamendoSection';
      section.style.cssText = 'margin-top:24px;padding-top:20px;border-top:1px solid #ffffff30';
      const heading = document.createElement('h3');
      heading.textContent = '🎧 Indie music · Jamendo';
      const explanation = document.createElement('p');
      explanation.className = 'muted small';
      explanation.textContent = 'Use the search above. Listen to credited independent artists here. Not a karaoke or music-download library.';
      const info = document.createElement('p');
      info.id = 'roJamendoStatus';
      info.className = 'muted small';
      info.setAttribute('role', 'status');
      info.textContent = 'Search to discover independent music.';
      const results = document.createElement('div');
      results.id = 'roJamendoResults';
      results.className = 'ro-cc-grid';
      section.append(heading, explanation, info, results);
      mainResults.parentNode.append(section);
    }
    if (form.dataset.jamendoConnected !== 'yes') {
      form.dataset.jamendoConnected = 'yes';
      form.addEventListener('submit', () => {
        const query = document.getElementById('roYtQuery')?.value.trim();
        if (query?.length >= 2) searchJamendo(query);
      });
    }
  }

  window.roCcMount = function () {
    if (typeof originalMount === 'function') originalMount();
    if (available) { showCatalog(); return; }
    if (!statusRequest) {
      statusRequest = fetch('/api/jamendo/status', { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(data => { available = data?.publicCatalogEnabled === true; if (available) showCatalog(); })
        .catch(() => {});
    }
  };
})();
