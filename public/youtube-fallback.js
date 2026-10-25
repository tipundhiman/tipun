/* Listen & Chill: keep browsing and playback inside RhymeOrbit, even without a Data API key. */
(function () {
  'use strict';
  const searchLive = window.roYtSearch;
  const mountLive = window.roCcMount;
  if (typeof searchLive !== 'function') return;
  // Verified public YouTube watch IDs. Never label this hand-picked list as live trends.
  const featured = [
    { id:'BSJa1UytM8w', title:'Saiyaara — Title Song', channel:'YRF', category:'hindi', tags:'hindi latest love bollywood romantic' },
    { id:'tk8ya-cJtrs', title:'Kesariya — Dance Mix', channel:'Sony Music India', category:'hindi', tags:'hindi dance brahmastra bollywood arijit' },
    { id:'jCVjudmnByk', title:'Saiyaara — Lyrical', channel:'YRF Music', category:'hindi', tags:'hindi lyrical romantic' },
    { id:'XtZTpxnrHAc', title:'Aaj Ki Raat — Stree 2', channel:'Sachin-Jigar', category:'hindi', tags:'hindi dance bollywood' },
    { id:'1G4isv_Fylg', title:'Paradise', channel:'Coldplay', category:'global', tags:'dreamy chill rock pop' },
    { id:'JGwWNGJdvx8', title:'Shape of You', channel:'Ed Sheeran', category:'global', tags:'dance pop romantic' },
    { id:'e-ORhEE9VVg', title:'Blank Space', channel:'Taylor Swift', category:'global', tags:'romantic pop' },
    { id:'YykjpeuMNEk', title:'Hymn for the Weekend', channel:'Coldplay', category:'global', tags:'india colorful pop' }
  ];
  let videoFolder='hindi';
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
    art.className = 'ro-cc-art ro-video-cover';
    art.style.cssText = 'width:100%;padding:0;border:0;cursor:pointer;position:relative;overflow:hidden;background:radial-gradient(circle at 75% 25%,#b18ec550,transparent 60%),linear-gradient(135deg,#422e4d,#202d48)';
    art.setAttribute('aria-label', 'Play ' + item.title + ' here');
    const thumbnail = document.createElement('img');
    thumbnail.src = 'https://i.ytimg.com/vi/' + item.id + '/hqdefault.jpg';
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    thumbnail.style.cssText = 'width:100%;height:100%;object-fit:cover;transition:transform .35s';
    thumbnail.addEventListener('error',()=>{thumbnail.remove();art.dataset.noCover='true';});
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
    artist.textContent = item.channel;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn sm';
    button.textContent = '▶ Play here';
    button.onclick = () => play(item.id, item.title);
    const link=document.createElement('a');link.className='ro-indian-source';
    link.href='https://www.youtube.com/watch?v='+item.id;link.target='_blank';link.rel='noopener noreferrer';
    link.textContent='On YouTube ↗';
    const actions=document.createElement('div');actions.className='ro-cc-tile-actions';actions.append(button,link);
    body.append(title, artist, actions);
    card.append(art, body);
    return card;
  }
  function showFeatured(query = '', folder = videoFolder) {
    const grid = document.getElementById('roYtGrid');
    const status = document.getElementById('roYtStatus');
    if (!grid || !status) return;
    videoFolder=folder;
    document.querySelectorAll('#roVideoFolders button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.folder===folder)));
    const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 1);
    let collection = folder==='all'?featured:featured.filter(item=>item.category===folder);
    let matching = words.length ? collection.filter(item => words.some(word => (item.title + ' ' + item.channel + ' ' + item.tags).toLowerCase().includes(word))) : collection;
    if(words.length&&!matching.length){
      const acrossAll=featured.filter(item=>words.some(word=>(item.title+' '+item.channel+' '+item.tags).toLowerCase().includes(word)));
      if(acrossAll.length){matching=acrossAll;collection=featured;videoFolder='all';document.querySelectorAll('#roVideoFolders button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.folder==='all')));}
    }
    grid.replaceChildren(...(matching.length ? matching : collection).map(tile));
    status.textContent = words.length
      ? (matching.length ? 'Showing featured matches · live YouTube search requires an API key.' : 'No featured match. Showing hand-picked videos; live search is not connected.')
      : 'Featured videos · play in the official YouTube player below.';
  }
  function installVideoFolders() {
    const status=document.getElementById('roYtStatus');
    if(!status||document.getElementById('roVideoFolders'))return;
    const container=document.createElement('div');container.id='roVideoFolders';container.className='ro-indian-folders';
    container.setAttribute('role','group');container.setAttribute('aria-label','Browse YouTube video collections');
    for(const [id,label] of [['hindi','🇮🇳 Hindi videos'],['global','🌍 Global hits'],['all','✨ All featured']]){
      const button=document.createElement('button');button.type='button';button.className='ro-indian-folder';
      button.dataset.folder=id;button.textContent=label;button.setAttribute('aria-pressed',String(id===videoFolder));
      button.addEventListener('click',()=>showFeatured('',id));container.append(button);
    }
    status.parentNode.insertBefore(container,status);
  }
  window.roYtShowFeatured = showFeatured;
  window.roYtSearch = async function (event) {
    await searchLive(event);
    const input = document.getElementById('roYtQuery');
    const status = document.getElementById('roYtStatus');
    const grid = document.getElementById('roYtGrid');
    if (!input || !status || !grid) return;
    if (/^YouTube unavailable:/.test(status.textContent || '')) {
      showFeatured(input.value.trim());
      status.textContent = 'Live YouTube search is temporarily unavailable. These are featured videos, not search matches.';
      return;
    }
    if (/^No embeddable videos found/.test(status.textContent || '')) {
      // Never pass unrelated featured videos off as a match for the user's song.
      const link = document.createElement('a');
      link.className = 'btn sm';
      link.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(input.value.trim());
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Search this song on YouTube ↗';
      grid.replaceChildren(link);
      status.textContent = 'No embeddable video matched this search. You can search YouTube directly.';
      return;
    }
    // Keep creator links and YouTube branding intact.
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
      installVideoFolders();
      // The chosen source decides when to load video cards; do not briefly
      // flash YouTube thumbnails while the Hindi audio tab is initializing.
    };
  }
})();
