/* RhymeOrbit design system: persistent light-first theme and Lucide-style SVGs.
   SVG path geometry follows Lucide's ISC-licensed icon conventions. */
(function () {
  'use strict';
  if (window.roDesign) return;
  const KEY = 'rhymeorbit-theme';
  const paths = {
    house: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/>',
    headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M5 14H3v6h3a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zm14 0h2v6h-3a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z"/>',
    sparkles: '<path d="m12 3 1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9zM19 18l.5 1.5L21 20l-1.5.5L19 22l-.5-1.5L17 20l1.5-.5z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4"/>',
    pen: '<path d="M12 19h9M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-10a4 4 0 1 0-3-7.87M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    arrowRight: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    orbit: '<circle cx="12" cy="12" r="3"/><path d="M20.7 8.4c1.6 2.6.4 6.3-2.7 9.3-3.9 3.9-9.3 4.8-12.2 1.9S3.8 11.3 7.7 7.4C11.7 3.4 17.8 2.6 20.7 5.5"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m.1 3h.01"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    flame: '<path d="M12 22c4.4 0 7-3.6 7-7.3 0-4-2.1-6.2-4-8.7-.2 2.2-1.4 3.1-2.3 3.5C13 6 10.6 3.7 9 2c.2 4.2-4 7-4 12.7C5 18.8 7.7 22 12 22Z"/>',
    trophy: '<path d="M8 21h8m-4-4v4M7 4h10v7a5 5 0 0 1-10 0V4Zm0 1H4v3a4 4 0 0 0 4 4m9-7h3v3a4 4 0 0 1-4 4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    flower: '<path d="M12 12c-6-8-10 0-4 2-5 3 0 8 4 2 4 6 9 1 4-2 6-2 2-10-4-2Z"/><circle cx="12" cy="12" r="2"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    volume: '<path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/>',
    library: '<path d="M4 19V5m5 14V5m5 14V5m5 14V5"/><path d="M2 21h20"/>',
    radio: '<path d="M3 10a13 13 0 0 1 18 0M6 13a9 9 0 0 1 12 0m-9 3a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>'
  };
  const icon = (name, size = 20) => `<svg class="ro-lucide-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.sparkles}</svg>`;
  const INTRO_KEY = 'rhymeorbit-theme-picker-v1';
  const themes = {
    pearl: { label: 'Pearl', caption: 'Bright, balanced and calm', icon: 'sun', status: '#f7f8fc' },
    linen: { label: 'Linen', caption: 'Warm, natural and understated', icon: 'flower', status: '#fbf7ef' },
    coast: { label: 'Coast', caption: 'Cool, clear and focused', icon: 'globe', status: '#f2f8fb' },
    midnight: { label: 'Midnight', caption: 'Low-light, deep navy', icon: 'moon', status: '#10111a' }
  };
  let current = 'pearl';
  let hasSeenPicker = false;
  try {
    const saved = localStorage.getItem(KEY);
    current = saved === 'dark' ? 'midnight' : saved === 'light' ? 'pearl' : themes[saved] ? saved : 'pearl';
    hasSeenPicker = localStorage.getItem(INTRO_KEY) === '1';
  } catch (_) { /* private browsing */ }
  document.documentElement.dataset.theme = current === 'midnight' ? 'dark' : 'light';
  document.documentElement.dataset.roPalette = current;

  const iconNames = new Map([
    ['🎙️', 'mic'], ['🎙', 'mic'], ['🎤', 'mic'], ['🎧', 'headphones'],
    ['🎶', 'music'], ['🎵', 'music'], ['♫', 'music'], ['♩', 'music'], ['🎼', 'music'],
    ['▶️', 'play'], ['▶', 'play'], ['⏸️', 'pause'], ['⏸', 'pause'],
    ['❤️', 'heart'], ['❤', 'heart'], ['💖', 'heart'], ['💗', 'heart'],
    ['✨', 'sparkles'], ['🌟', 'sparkles'], ['⭐', 'sparkles'], ['✦', 'sparkles'],
    ['🔥', 'flame'], ['🏆', 'trophy'], ['🎬', 'film'], ['🎥', 'film'],
    ['📹', 'film'], ['📷', 'image'], ['📸', 'image'], ['🖼️', 'image'],
    ['📥', 'download'], ['⬇️', 'download'], ['⬇', 'download'], ['⇩', 'download'],
    ['🔎', 'search'], ['🔍', 'search'], ['🔊', 'volume'], ['👤', 'user'],
    ['👥', 'users'], ['♧', 'users'], ['🫶', 'heart'], ['✎', 'pen'],
    ['▣', 'film'], ['▤', 'library'], ['◎', 'orbit'], ['◉', 'user'],
    ['⌂', 'house'], ['☰', 'menu'], ['❋', 'flower'], ['❓', 'help'],
    ['🎸', 'music'], ['🎹', 'music'], ['🎷', 'music'], ['🎺', 'music'],
    ['🙏', 'heart'], ['🌿', 'flower'], ['🌾', 'flower'], ['🎉', 'sparkles'],
    ['💿', 'music'], ['🎯', 'check'], ['💎', 'sparkles'], ['✧', 'sparkles'],
    ['↗', 'arrowRight'], ['←', 'arrowLeft'], ['↓', 'download']
    ,['🌙', 'moon'], ['☀️', 'sun'], ['✅', 'check'], ['❌', 'close'],
    ['🧭', 'orbit'], ['🔒', 'shield'], ['🔐', 'shield'], ['🔁', 'music'],
    ['💡', 'sparkles'], ['🎨', 'image'], ['🎁', 'heart'], ['⚡', 'sparkles'],
    ['🇮🇳', 'globe'], ['🐱', 'headphones'], ['🦊', 'headphones'], ['🐻', 'headphones'],
    ['🪩', 'music'], ['🥁', 'music'], ['📻', 'radio'], ['📚', 'library']
  ]);
  const emojiPattern = new RegExp(Array.from(iconNames.keys()).sort((a, b) => b.length - a.length).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + '|\\p{Extended_Pictographic}\\uFE0F?', 'gu');
  const uiSelectors = 'button, a, label, h1, h2, h3, .note, .pitch small, .eyebrow, .sidebar-label, .glyph, .ro-cc-mascot, .ro-cc-stars, #roCcSceneText, .ro-mobile-feature-symbol, .ro-quick-icon, .avatars, [role="status"], .ro-cc-scene, .ro-cc-art, .hero-art, .float-notes, .chip, .pill, .feature, .feature-guide, #roGuideNudge, #roGuideDialog, .ro-cc-tile-actions, .ro-yt-search-note, .ro-yt-search-spark';
  const skipSelectors = 'input, textarea, select, [contenteditable], .ro-feed-post, .ro-user-content, #ssCurrentLine, #ssNextLine, .ro-cc-song-name, .ro-song-title, .track-title, .ro-cc-tile h4, .ro-indian-tile h4';

  function iconifyText(node) {
    if (!node || node.nodeType !== 3 || !node.nodeValue || !emojiPattern.test(node.nodeValue)) { emojiPattern.lastIndex = 0; return; }
    emojiPattern.lastIndex = 0;
    const parent = node.parentElement;
    if (!parent || parent.closest(skipSelectors) || !parent.closest(uiSelectors)) return;
    const content = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let index = 0;
    for (const match of content.matchAll(emojiPattern)) {
      if (match.index > index) fragment.appendChild(document.createTextNode(content.slice(index, match.index)));
      const holder = document.createElement('span');
      holder.innerHTML = icon(iconNames.get(match[0]), 17);
      fragment.appendChild(holder.firstChild);
      index = match.index + match[0].length;
    }
    if (index < content.length) fragment.appendChild(document.createTextNode(content.slice(index)));
    node.replaceWith(fragment);
  }

  function iconify(root) {
    if (!root) return;
    if (root.nodeType === 3) { iconifyText(root); return; }
    if (root.nodeType !== 1 || root.matches('script, style, noscript, svg')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(iconifyText);
  }

  function syncToggles() {
    const label = `Change appearance, currently ${themes[current].label}`;
    for (const button of document.querySelectorAll('[data-ro-theme-toggle]')) {
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      const graphic = button.querySelector('[data-ro-theme-icon]');
      if (graphic) graphic.innerHTML = icon(themes[current].icon, 19);
      const value = button.querySelector('[data-ro-theme-value]');
      if (value) value.textContent = `${themes[current].label} theme`;
    }
    for (const button of document.querySelectorAll('[data-ro-palette-choice]')) {
      button.setAttribute('aria-pressed', String(button.dataset.roPaletteChoice === current));
    }
  }

  function apply(theme) {
    current = theme === 'dark' ? 'midnight' : theme === 'light' ? 'pearl' : themes[theme] ? theme : 'pearl';
    document.documentElement.dataset.theme = current === 'midnight' ? 'dark' : 'light';
    document.documentElement.dataset.roPalette = current;
    try { localStorage.setItem(KEY, current); } catch (_) { /* private browsing */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themes[current].status);
    syncToggles();
  }

  let picker = null;
  let pickerOrigin = null;
  function markPickerSeen() {
    hasSeenPicker = true;
    try { localStorage.setItem(INTRO_KEY, '1'); } catch (_) { /* private browsing */ }
  }

  function createPicker() {
    if (picker || !document.body) return;
    picker = document.createElement('div');
    picker.id = 'roThemePicker';
    picker.className = 'ro-theme-picker';
    picker.hidden = true;
    picker.innerHTML = `<div class="ro-theme-scrim" data-ro-theme-dismiss></div>
      <section class="ro-theme-panel" role="dialog" aria-modal="true" aria-labelledby="roThemeTitle" aria-describedby="roThemeDescription">
        <div class="ro-theme-panel-top"><span class="ro-theme-kicker">MAKE IT YOURS</span><button type="button" class="ro-theme-close" data-ro-theme-dismiss aria-label="Close appearance settings">${icon('close', 21)}</button></div>
        <h2 id="roThemeTitle">Choose how RhymeOrbit feels.</h2>
        <p id="roThemeDescription">Four thoughtful looks. Pick one now, or change it anytime from Appearance.</p>
        <div class="ro-theme-options" role="group" aria-label="Color theme">
          ${Object.entries(themes).map(([id, theme]) => `<button class="ro-theme-choice" type="button" data-ro-palette-choice="${id}" aria-pressed="false"><span class="ro-theme-swatch" aria-hidden="true"><span class="ro-theme-swatch-header"></span><span class="ro-theme-swatch-heading"></span><span class="ro-theme-swatch-line"></span><span class="ro-theme-swatch-cards"><i></i><i></i></span></span><span class="ro-theme-choice-heading">${icon(theme.icon, 17)} <strong>${theme.label}</strong></span><small>${theme.caption}</small></button>`).join('')}
        </div>
        <div class="ro-theme-panel-bottom"><span>Your preference is saved on this device.</span><button type="button" class="ro-theme-confirm" data-ro-theme-confirm>Use this theme ${icon('arrowRight', 17)}</button></div>
      </section>`;
    document.body.appendChild(picker);
    picker.addEventListener('click', event => {
      const choice = event.target.closest('[data-ro-palette-choice]');
      if (choice) { apply(choice.dataset.roPaletteChoice); return; }
      if (event.target.closest('[data-ro-theme-confirm], [data-ro-theme-dismiss]')) closePicker();
    });
    picker.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closePicker(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(picker.querySelectorAll('button:not([disabled])'));
      if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  function openPicker() {
    createPicker();
    if (!picker) return;
    pickerOrigin = document.activeElement;
    picker.hidden = false;
    document.body.classList.add('ro-theme-picker-open');
    syncToggles();
    const selected = picker.querySelector(`[data-ro-palette-choice="${current}"]`);
    (selected || picker.querySelector('button')).focus();
  }

  function closePicker() {
    if (!picker) return;
    picker.hidden = true;
    document.body.classList.remove('ro-theme-picker-open');
    markPickerSeen();
    if (pickerOrigin && typeof pickerOrigin.focus === 'function' && pickerOrigin.isConnected) pickerOrigin.focus();
    pickerOrigin = null;
  }

  function refresh() {
    if (!document.body) return;
    const target = document.querySelector('.header-actions') || document.querySelector('body > header .top') || document.querySelector('body > header .wrap') || document.querySelector('body > header .topbar') || document.querySelector('body > header');
    if (target && !target.querySelector('.ro-theme-toggle')) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'ro-theme-toggle';
      toggle.dataset.roThemeToggle = 'true';
      toggle.innerHTML = `<span data-ro-theme-icon></span><span class="ro-theme-label" data-ro-theme-value></span>`;
      target.appendChild(toggle);
    }
    syncToggles();
    iconify(document.body);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-ro-theme-toggle]');
    if (button) { event.preventDefault(); openPicker(); }
  });
  window.roDesign = { icon, refresh, apply, openPicker, getTheme: () => current };
  function ready() {
    refresh();
    createPicker();
    if (!hasSeenPicker) setTimeout(openPicker, 420);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  const observer = new MutationObserver(mutations => {
    for (const change of mutations) {
      if (change.type === 'characterData') iconifyText(change.target);
      else for (const node of change.addedNodes) iconify(node);
    }
    const target = document.querySelector('.header-actions') || document.querySelector('body > header .top') || document.querySelector('body > header .wrap') || document.querySelector('body > header');
    if (target && !target.querySelector('.ro-theme-toggle')) refresh();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
