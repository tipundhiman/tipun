/* Listen & Chill: keep browsing and playback inside RhymeOrbit, even without a Data API key. */
(function () {
  'use strict';
  const searchLive = window.roYtSearch;
  const mountLive = window.roCcMount;
  if (typeof searchLive !== 'function') return;
  // Small, clearly labelled featured selection (not an unlicensed search scraper).
  const featured = [
    { id: '1G4isv_Fylg', title: 'Paradise', channel: 'Coldplay', tags: 'dreamy chill rock pop' },
    { id: 'JGwWNGJdvx8', title: 'Shape of You', channel: 'Ed Sheeran', tags: 'dance pop romantic' },
    { id: 'e-ORhEE9VVg', title: 'Blank Space', channel: 'Taylor Swift', tags: 'romantic pop' },
    { id: 'YykjpeuMNEk', title: 'Hymn for the Weekend', channel: 'Coldplay', tags: 'hindi india colorful pop' }
  ];
  function play(id, title) {
    window.roYtPlay(id, title);
    document.getElementById('roCcScene')?.classList.add('playing');
    const message = document.getElementById('roCcSceneText');
    if (message) message.textContent = 'Now playing: ' + title + ' ✨';
  }
  function tile(item) {
    const card = document.createElement('article');
    card.className = 'ro-cc-tile';
    const art = document.createElement('button');
    art.type = 'button';
    art.className = 'ro-cc-art';
    art.style.cssText = 'width:100%;padding:0;border:0;cursor:pointer;position:relative;overflow:hidden';
    art.setAttribute('aria-label', 'Play ' + item.title + ' here');
    const thumbnail = document.createElement('img');
    thumbnail.src = 'https://i.ytimg.com/vi/' + item.id + '/hqdefault.jpg';
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    thumbnail.style.cssText = 'width:100%;height:100%;object-fit:cover;transition:transform .35s';
    const badge = document.createElement('span');
    badge.textContent = '▶';
    badge.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;font-size:32px;color:white;text-shadow:0 0 20px #000';
    art.append(thumbnail, badge);
    art.onclick = () => play(item.id, item.title);
    const body = document.createElement('div');
    body.className = 'ro-cc-tile-body';
    const title = document.createElement('h4');
    title.textContent = item.title;
    const artist = document.createElement('p');
    artist.className = 'muted small';
    artist.textContent = item.channel + ' · YouTube player';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn sm';
    button.textContent = '▶ Play here';
    button.onclick = () => play(item.id, item.title);
    body.append(title, artist, button);
    card.append(art, body);
    return card;
  }
  function showFeatured(query = '') {
    const grid = document.getElementById('roYtGrid');
    const status = document.getElementById('roYtStatus');
    if (!grid || !status) return;
    const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 1);
    const matching = words.length ? featured.filter(item => words.some(word => (item.title + ' ' + item.channel + ' ' + item.tags).toLowerCase().includes(word))) : featured;
    grid.replaceChildren(...(matching.length ? matching : featured).map(tile));
    status.textContent = words.length
      ? (matching.length ? '🎧 Featured matches you can watch here.' : '🎧 Live search is not connected. Enjoy these featured in-app music videos.')
      : '🎧 Featured music videos — tap any tile to play without leaving RhymeOrbit.';
  }
  window.roYtShowFeatured = showFeatured;
  window.roYtSearch = async function (event) {
    await searchLive(event);
    const input = document.getElementById('roYtQuery');
    const status = document.getElementById('roYtStatus');
    const grid = document.getElementById('roYtGrid');
    if (!input || !status || !grid) return;
    if (/^YouTube unavailable:|^No embeddable videos found/.test(status.textContent || '')) {
      showFeatured(input.value.trim());
      return;
    }
    grid.querySelectorAll('a[href^="https://www.youtube.com/"]').forEach(link => link.remove());
    grid.querySelectorAll('.ro-cc-art').forEach(art => {
      const playButton = art.closest('.ro-cc-tile')?.querySelector('button');
      if (playButton) {
        art.style.cursor = 'pointer';
        art.setAttribute('role', 'button');
        art.tabIndex = 0;
        art.onclick = () => playButton.click();
        art.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playButton.click(); } };
      }
    });
  };
  if (typeof mountLive === 'function') {
    window.roCcMount = function () {
      mountLive();
      const grid = document.getElementById('roYtGrid');
      if (grid && !grid.children.length) showFeatured();
    };
  }
})();
