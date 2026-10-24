/* Optional independent-artist listening inside the existing Listen & Chill tab.
   This does not expose credentials or enable Jamendo when licensing is pending. */
(function () {
  'use strict';
  const originalMount = window.roCcMount;
  let statusRequest = null;
  let available = false;
  let searchCount = 0;
  let searchAbort = null;
  let moreOffset = 0;
  let moreQuery = '';

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

  async function searchJamendo(query, append = false) {
    const result = document.getElementById('roJamendoResults');
    const info = document.getElementById('roJamendoStatus');
    const more = document.getElementById('roJamendoMore');
    if (!result || !info || query.length < 2) return;
    if (append && (!moreOffset || moreQuery !== query)) return;
    const current = ++searchCount;
    searchAbort?.abort();
    searchAbort = new AbortController();
    const offset = append ? moreOffset : 0;
    info.textContent = append ? 'Loading more indie songs…' : 'Finding independent artists…';
    if (more) more.hidden = true;
    if (!append) result.replaceChildren();
    try {
      const response = await fetch('/api/jamendo/search?q=' + encodeURIComponent(query) + '&offset=' + offset, {
        signal: searchAbort.signal
      });
      const data = await response.json();
      if (current !== searchCount || !document.getElementById('roJamendoResults')) return;
      if (!response.ok) throw Error(data.error || 'Jamendo unavailable');
      const items = Array.isArray(data.items) ? data.items : [];
      result.append(...items.map(songCard));
      const count = result.children.length;
      info.textContent = count ? count + ' independent tracks loaded. Explore more below.' : 'No eligible indie tracks matched. Try Rock, Piano or Acoustic.';
      moreOffset = data.hasMore ? Number(data.nextOffset) : 0;
      moreQuery = query;
      if (more) more.hidden = !moreOffset;
    } catch (error) {
      if (error.name === 'AbortError' || current !== searchCount) return;
      info.textContent = 'Independent catalog unavailable for now. You can still use the other music players.';
      if (more) more.hidden = !append;
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
      more.textContent = 'Show more indie songs ↓';
      more.style.cssText = 'margin:18px auto 8px';
      more.hidden = true;
      more.addEventListener('click', () => searchJamendo(moreQuery, true));
      section.append(heading, explanation, genres, info, results, more);
      mainResults.parentNode.insertBefore(section, mainResults);
      searchJamendo('rock');
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
