/* Shared, accessible mobile app navigation; never replaces an active player. */
(function () {
  'use strict';
  if (window.roMobileApp) return;

  const icons = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    songs: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    sing: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/>',
    create: '<path d="m12 3 1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9zM19 18l.5 1.5L21 20l-1.5.5L19 22l-.5-1.5L17 20l1.5-.5z"/>',
    more: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    arrowRight: '<path d="M5 12h14m-6-6 6 6-6 6"/>'
  };
  const svg = name => {
    const shared = { home: 'house', songs: 'music', sing: 'mic', create: 'sparkles', more: 'grid' };
    if (window.roDesign?.icon) return window.roDesign.icon(shared[name] || name, 22);
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  };
  const tabs = [
    { name: 'Home', icon: 'home', href: '/', page: 'home' },
    { name: 'Songs', icon: 'songs', href: '/#listen', page: 'listen' },
    { name: 'Sing', icon: 'sing', href: '/sing-your-song', page: 'sing' },
    { name: 'Create', icon: 'create', href: '/#studio', page: 'studio' }
  ];
  const features = [
    { title: 'AI Studio', subtitle: 'Make original music', icon: 'sparkles', href: '/#studio' },
    { title: 'Creator Lab', subtitle: '20 free creation tools', icon: 'sparkles', href: '/creator-lab' },
    { title: 'Listen & Chill', subtitle: 'Free music & videos', icon: 'music', href: '/#listen' },
    { title: 'Sing Your Song', subtitle: 'Your karaoke stage', icon: 'mic', href: '/sing-your-song' },
    { title: 'Video Maker', subtitle: 'Turn songs into visuals', icon: 'film', href: '/video-maker' },
    { title: 'Vocal Lab', subtitle: 'Explore audio tools', icon: 'headphones', href: '/vocal-lab' },
    { title: 'AI Lyrics', subtitle: 'Write something new', icon: 'pen', href: '/ai-lyrics-generator' },
    { title: 'Shayari', subtitle: 'Words with feeling', icon: 'heart', href: '/shayari-generator' },
    { title: 'Community', subtitle: 'Find your people', icon: 'users', href: '/#community' },
    { title: 'My Studio', subtitle: 'Your saved creations', icon: 'library', href: '/#projects' },
    { title: 'Download Audio', subtitle: 'Your music library', icon: 'download', href: '/#downloads' },
    { title: 'Vibe Match', subtitle: 'Discover creators', icon: 'orbit', href: '/#match' },
    { title: 'Install App', subtitle: 'Keep RhymeOrbit close', icon: 'download', href: '/install' },
    { title: 'Help & Support', subtitle: 'We are here to help', icon: 'help', href: '/#help' }
  ];
  let bar;
  let sheet;
  let moreButton;
  let lastFocus;

  function activePage(override) {
    const path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    if (path === '/sing-your-song') return 'sing';
    if (path !== '/' && path !== '/index') return 'more';
    const hash = location.hash.replace('#', '');
    const page = override || hash || 'home';
    return tabs.some(tab => tab.page === page) ? page : 'more';
  }

  function refresh(page) {
    if (!bar) return;
    const active = activePage(page);
    for (const item of bar.querySelectorAll('[data-ro-tab]')) {
      const selected = item.dataset.roTab === active;
      item.classList.toggle('is-active', selected);
      if (selected && item.tagName === 'A') item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove('ro-mobile-sheet-open');
    moreButton?.setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  function open() {
    if (!sheet) return;
    if (!sheet.hidden) { close(); return; }
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add('ro-mobile-sheet-open');
    moreButton.setAttribute('aria-expanded', 'true');
    sheet.querySelector('.ro-mobile-sheet-close').focus({ preventScroll: true });
  }

  function activateLink(event) {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !['/', '/index.html'].includes(url.pathname)) return;
    if (!['/', '/index.html'].includes(location.pathname) || typeof window.go !== 'function') return;
    event.preventDefault();
    const destination = url.hash.slice(1) || 'home';
    close();
    window.go(destination);
    refresh(destination);
  }

  function mount() {
    if (document.getElementById('roMobileTabBar')) return;
    bar = document.createElement('nav');
    bar.id = 'roMobileTabBar';
    bar.className = 'ro-mobile-tab-bar';
    bar.setAttribute('aria-label', 'Mobile app navigation');
    bar.innerHTML = tabs.map(tab => `<a class="ro-mobile-tab ${tab.page === 'sing' ? 'ro-mobile-tab-sing' : ''}" data-ro-tab="${tab.page}" href="${tab.href}" aria-label="${tab.name}"><span class="ro-mobile-tab-icon">${svg(tab.icon)}</span><span class="ro-mobile-tab-label">${tab.name}</span></a>`).join('') + `<button type="button" class="ro-mobile-tab ro-mobile-more-button" data-ro-tab="more" aria-label="More RhymeOrbit features" aria-haspopup="dialog" aria-expanded="false" aria-controls="roMobileFeatureSheet"><span class="ro-mobile-tab-icon">${svg('more')}</span><span class="ro-mobile-tab-label">More</span></button>`;
    moreButton = bar.querySelector('.ro-mobile-more-button');
    moreButton.addEventListener('click', open);
    bar.addEventListener('click', activateLink);

    sheet = document.createElement('div');
    sheet.id = 'roMobileFeatureSheet';
    sheet.className = 'ro-mobile-feature-sheet';
    sheet.hidden = true;
    sheet.innerHTML = `<div class="ro-mobile-sheet-scrim" data-ro-close="true"></div><section class="ro-mobile-sheet-panel" role="dialog" aria-modal="true" aria-label="Explore RhymeOrbit features"><div class="ro-mobile-sheet-grip" aria-hidden="true"></div><header class="ro-mobile-sheet-head"><div><span class="ro-mobile-sheet-eyebrow">YOUR MUSIC UNIVERSE</span><h2>Explore your <em>orbit.</em></h2><p>Every creative tool, one tap away.</p></div><button type="button" class="ro-mobile-sheet-close" aria-label="Close features">${svg('close')}</button></header><button type="button" class="ro-mobile-theme-card" data-ro-theme-toggle="true" aria-label="Change appearance"><span data-ro-theme-icon>${svg('moon')}</span><span><strong>Appearance</strong><small data-ro-theme-value>Light theme</small></span><span class="ro-mobile-theme-arrow">${svg('arrowRight')}</span></button><div class="ro-mobile-sheet-grid">${features.map(item => `<a class="ro-mobile-sheet-card" href="${item.href}"><span class="ro-mobile-feature-symbol" aria-hidden="true">${svg(item.icon)}</span><strong>${item.title}</strong><small>${item.subtitle}</small></a>`).join('')}</div></section>`;
    sheet.addEventListener('click', event => {
      if (event.target.closest('[data-ro-close], .ro-mobile-sheet-close')) close();
      else activateLink(event);
    });
    document.addEventListener('keydown', event => {
      if (!sheet || sheet.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const controls = Array.from(sheet.querySelectorAll('button, a[href]'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    document.body.append(bar, sheet);
    window.roDesign?.refresh();
    window.addEventListener('hashchange', () => refresh());
    window.addEventListener('popstate', () => refresh());
    refresh();
  }

  window.roMobileApp = { refresh, close, open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
