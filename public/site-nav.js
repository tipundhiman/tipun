/* Shared cross-page navigation for RhymeOrbit's standalone tools and guides. */
(function () {
  'use strict';

  const links = [
    { label: 'Home', href: '/', symbol: '⌂' },
    { label: 'Listen & Chill', href: '/#listen', symbol: '♫' },
    { label: 'Sing Your Song', href: '/sing-your-song', symbol: '♩' },
    { label: 'AI Studio', href: '/#studio', symbol: '✦' },
    { label: 'Video Maker', href: '/video-maker', symbol: '▣' },
    { label: 'Vocal Lab', href: '/vocal-lab', symbol: '◉' },
    { label: 'AI Lyrics', href: '/ai-lyrics-generator', symbol: '✎' },
    { label: 'Community', href: '/#community', symbol: '♧' },
    { label: 'Shayari', href: '/shayari-generator', symbol: '❋' },
    { label: 'Install App', href: '/install', symbol: '↓' }
  ];

  function normalizedPath(path) {
    return path.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  }

  function canGoBack() {
    if (!document.referrer || window.history.length < 2) return false;
    try {
      const previous = new URL(document.referrer);
      return previous.origin === window.location.origin &&
        previous.href !== window.location.href &&
        !/\/(reset-password|auth)(?:\/|$)/.test(previous.pathname);
    } catch (_) {
      return false;
    }
  }

  function mount() {
    if (document.querySelector('.ro-quick-nav')) return;
    const header = document.querySelector('body > header');
    if (!header) return;

    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.webmanifest';
      document.head.appendChild(manifest);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const touchIcon = document.createElement('link');
      touchIcon.rel = 'apple-touch-icon';
      touchIcon.href = '/icons/apple-touch-icon.png';
      document.head.appendChild(touchIcon);
    }

    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/site-nav.css?v=20261025-1';
    document.head.appendChild(stylesheet);

    // Keep the same thumb-friendly app navigation on standalone creator tools.
    if (!document.querySelector('link[href^="/mobile-app.css"]')) {
      const mobileStyle = document.createElement('link');
      mobileStyle.rel = 'stylesheet';
      mobileStyle.href = '/mobile-app.css?v=20261025-1';
      document.head.appendChild(mobileStyle);
    }
    if (!document.querySelector('script[src^="/mobile-app.js"]')) {
      const mobileScript = document.createElement('script');
      mobileScript.src = '/mobile-app.js?v=20261025-1';
      mobileScript.defer = true;
      document.head.appendChild(mobileScript);
    }

    const wrapper = document.createElement('nav');
    wrapper.className = 'ro-quick-nav';
    wrapper.setAttribute('aria-label', 'Quick navigation between RhymeOrbit features');

    const back = document.createElement('a');
    back.className = 'ro-quick-back';
    back.href = '/';
    back.textContent = '← Back';
    back.setAttribute('aria-label', 'Back to previous page, or Home');
    back.addEventListener('click', function (event) {
      if (!canGoBack()) return;
      event.preventDefault();
      window.history.back();
    });
    wrapper.appendChild(back);

    const scroller = document.createElement('div');
    scroller.className = 'ro-quick-links';
    scroller.setAttribute('role', 'group');
    scroller.setAttribute('aria-label', 'Other features');
    const current = normalizedPath(window.location.pathname);
    for (const item of links) {
      const link = document.createElement('a');
      link.href = item.href;
      link.className = 'ro-quick-link';
      const active = !item.href.includes('#') && normalizedPath(item.href) === current;
      if (active) {
        link.classList.add('ro-quick-active');
        link.setAttribute('aria-current', 'page');
      }
      const icon = document.createElement('span');
      icon.className = 'ro-quick-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = item.symbol;
      const text = document.createElement('span');
      text.textContent = item.label;
      link.append(icon, text);
      scroller.appendChild(link);
    }
    wrapper.appendChild(scroller);
    header.insertAdjacentElement('afterend', wrapper);
    const selected = scroller.querySelector('.ro-quick-active');
    if (selected) selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
