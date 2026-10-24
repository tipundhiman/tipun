/* RhymeOrbit feature finder + optional first-visit tour. Works on SPA and standalone tools. */
(function () {
  'use strict';
  if (document.getElementById('roGuideButton')) return;
  const links = [
    ['🎤', 'Make an AI song', 'Create complete original songs with vocals and music.', '/#studio', 'Create', 'song,generate,vocals,beats,music'],
    ['✍️', 'Write song lyrics', 'Get AI ideas, change the lines and save your drafts.', '/#studio', 'Create', 'write,text,words,lyrics'],
    ['💖', 'Shayari & spoken poetry', 'Write Shayari and listen with voice or soft music.', '/#studio', 'Create', 'poetry,hindi,speak,voice'],
    ['✨', 'Chat with Riya', 'Get friendly writing and website help.', '/#help', 'Create', 'chat,bot,assistant,guide'],
    ['🎬', 'Animate my lyrics', 'Make cartoon lyric videos with original background music.', '/video-maker', 'Video', 'animation,movie,reel,shorts'],
    ['📽️', 'Earlier saved videos', 'Access your older private video archive. New videos download to your device.', '/video-maker#videos', 'Video', 'r2,video,storage'],
    ['🎚️', 'Vocal Lab', 'Clean background noise and try basic vocal tools.', '/vocal-lab', 'Audio', 'noise,autotune,remove,vocal,clean'],
    ['🎙️', 'Sing Your Song', 'Choose a ready-made original karaoke, record your voice or practise singing notes.', '/sing-your-song', 'Audio', 'microphone,record,karaoke,sing,coach,lesson'],
    ['⬇️', 'Download my songs', 'Play and download your own generated tracks.', '/#downloads', 'Audio', 'mp3,wav,download,songs'],
    ['🎧', 'Listen & Chill', 'Listen to music videos in the RhymeOrbit player.', '/#listen', 'Explore', 'youtube,player,music,listen'],
    ['💾', 'My Studio', 'See your lyrics and saved projects.', '/#projects', 'Library', 'drafts,saved,projects'],
    ['👩‍🎤', 'My profile', 'Manage your artist identity and greeting.', '/#profile', 'Library', 'account,settings,name'],
    ['🌎', 'Community', 'Explore posts and share ideas with creators.', '/#community', 'Explore', 'friends,post,social'],
    ['🫶', 'Vibe Match · early access', 'Explore creator collaboration as it becomes available.', '/#match', 'Explore', 'collab,match,artist'],
    ['👑', 'Memberships', 'See Free, Premium and Pro plan previews.', '/#profile', 'Account', 'pricing,credits,plans,premium'],
    ['❔', 'Help & support', 'Find FAQs or ask Riya.', '/#help', 'Account', 'help,faq,support']
  ];
  const journeys = [
    {name:'1 / CREATE',title:'Start with one idea',body:'Song, lyrics ya Shayari — pehle bas apna idea likho. AI Studio se shuru karo.',tasks:[0,1,2]},
    {name:'2 / MAKE IT YOURS',title:'Turn words into something beautiful',body:'Animated video banao, Karaoke mein gaao, audio saaf karo, ya Riya se idea poochho.',tasks:[4,7,3]},
    {name:'3 / KEEP IT SAFE',title:'Your work, one place',body:'Apne songs Download Audio mein, lyrics My Studio mein, aur finished video apne device par download karo.',tasks:[8,10,5]},
    {name:'4 / CONNECT',title:'Share and explore',body:'Community mein creators dekho, apna profile banao aur music suno.',tasks:[12,11,9]}
  ];
  const css = document.createElement('style');
  css.textContent = `
    #roGuideButton{position:fixed;left:18px;bottom:88px;z-index:1990;border:1px solid #e5c9a2;color:#251b27;background:linear-gradient(110deg,#f1d8b8,#dcbbe9);box-shadow:0 13px 45px #0007;border-radius:999px;padding:13px 19px;font:800 15px/1.2 system-ui;cursor:pointer;transition:transform .2s}
    #roGuideButton:hover{transform:translateY(-3px)}
    #roGuideDialog{border:1px solid #ffffff38;border-radius:24px;background:#15131e;color:#f8f3f6;width:min(790px,calc(100vw - 24px));max-height:min(86vh,800px);padding:clamp(20px,4vw,34px);box-shadow:0 35px 100px #000b;overflow:auto;font:15px/1.55 system-ui}
    #roGuideDialog::backdrop{background:#08050dd9;backdrop-filter:blur(7px)}
    #roGuideDialog .roGuideTop{display:flex;justify-content:space-between;align-items:start;gap:16px}
    #roGuideDialog h2{font-size:clamp(25px,4vw,38px);line-height:1.16;letter-spacing:-1px;margin:7px 0 8px;color:#f9eee5}
    #roGuideDialog .roGuideMuted{color:#bdb2c8;margin:0 0 14px}
    #roGuideDialog button,#roGuideDialog input{font:inherit}
    #roGuideDialog button:focus-visible,#roGuideDialog a:focus-visible,#roGuideDialog input:focus-visible,#roGuideButton:focus-visible{outline:3px solid #e5c9a2;outline-offset:3px}
    #roGuideClose{border:1px solid #ffffff40;border-radius:50%;width:42px;height:42px;background:#ffffff0c;color:white;font-size:25px;flex-shrink:0;cursor:pointer}
    #roGuideInput{width:100%;min-height:49px;margin:15px 0 12px;border:1px solid #ffffff4b;border-radius:14px;background:#0b0b13;color:white;padding:13px 15px;font-size:16px!important}
    #roGuideGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:10px;max-height:47vh;overflow:auto;padding:3px}
    #roGuideGrid a{display:block;text-decoration:none;color:#fff;padding:16px;border:1px solid #ffffff20;border-radius:16px;background:linear-gradient(130deg,#34263d,#171821);transition:transform .2s,border-color .2s}
    #roGuideGrid a:hover{transform:translateY(-3px);border-color:#e5c9a27e}
    #roGuideGrid strong{font-size:15px;display:block;margin-bottom:3px}
    #roGuideGrid span{font-size:12px;color:#c9c0ce}
    #roGuideCategories{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}
    #roGuideCategories button,.roGuideAction{border:1px solid #e5c9a254;border-radius:999px;padding:9px 13px;background:#e5c9a214;color:#eedbc8;font-weight:750;cursor:pointer}
    #roGuideCategories button[aria-pressed="true"],.roGuideAction.primary{background:#e5c9a2;color:#251823}
    #roGuideActions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:20px;padding-top:15px;border-top:1px solid #ffffff20}
    #roGuideTour[hidden],#roGuideFinder[hidden]{display:none}
    #roGuideSteps{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}
    #roGuideSteps button{width:44px;height:44px;border:1px solid #ffffff50;border-radius:50%;background:#ffffff10;color:white;cursor:pointer}
    #roGuideSteps button[aria-current="step"]{background:#e5c9a2;color:#241923}
    #roGuideNudge{position:fixed;left:16px;bottom:152px;width:min(350px,calc(100vw - 32px));z-index:1980;border:1px solid #e5c9a258;border-radius:18px;padding:17px;background:#231c2c;color:#fff;box-shadow:0 15px 55px #000a;font:14px/1.5 system-ui}
    #roGuideNudge strong{display:block;font-size:16px;margin-bottom:5px}
    #roGuideNudge .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    #roGuideNudge button{padding:9px 12px;border-radius:10px;border:1px solid #e5c9a255;background:#e5c9a211;color:#fff;cursor:pointer}
    #roGuideNudge button:first-child{background:#e5c9a2;color:#271b24;font-weight:800}
    body:has(#roAdminOverlay) #roGuideButton,body:has(#roAdminOverlay) #roGuideNudge{display:none}
    .roQuickStart{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:18px 0 0;max-width:700px}
    .roQuickStart strong{color:#e5c9a2;font-size:13px;margin-right:2px}
    .roQuickStart a{color:#f8e7d2;text-decoration:none;font:700 14px system-ui;padding:11px 15px;border:1px solid #e5c9a24b;border-radius:999px;background:#ffffff0b;transition:background .2s,transform .2s}
    .roQuickStart a:hover{background:#e5c9a22a;transform:translateY(-2px)}
    @media(max-width:600px){#roGuideButton{padding:12px 14px;left:10px;bottom:78px}#roGuideNudge{bottom:143px}#roGuideDialog{max-height:90vh}#roGuideGrid{grid-template-columns:1fr;max-height:43vh}.roQuickStart{gap:7px}}
    @media(prefers-reduced-motion:reduce){#roGuideButton,#roGuideGrid a,.roQuickStart a{transition:none!important}}
  `;
  document.head.append(css);

  const trigger = document.createElement('button');
  trigger.id = 'roGuideButton';trigger.type = 'button';trigger.textContent = '🧭 Find a feature';
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','roGuideDialog');
  const dialog = document.createElement('dialog');dialog.id = 'roGuideDialog';
  dialog.setAttribute('aria-label','RhymeOrbit feature finder and guided tour');
  dialog.innerHTML = `<div class="roGuideTop"><div><small style="color:#e5c9a2;font-weight:800;letter-spacing:2px">RHYMEORBIT · EASY MODE</small><h2>What would you like to do?</h2><p class="roGuideMuted">Apna kaam select karo. We'll take you straight there. ✨</p></div><button id="roGuideClose" type="button" aria-label="Close feature finder">×</button></div><div id="roGuideFinder"><label for="roGuideInput" style="font-weight:700">Search tools by name or need</label><input id="roGuideInput" type="search" placeholder="e.g. Make a song, clean noise, save videos…" autocomplete="off"><div id="roGuideCategories" role="group" aria-label="Filter by category"></div><div id="roGuideGrid"></div><p id="roGuideEmpty" hidden>No matching feature. Try “music”, “video” or “Shayari”.</p></div><div id="roGuideTour" hidden><span id="roGuideStepName" style="color:#e5c9a2;font-weight:850"></span><h2 id="roGuideStepTitle"></h2><p class="roGuideMuted" id="roGuideStepBody"></p><div id="roGuideSteps" aria-label="Tour steps"></div><div id="roGuideTourLinks" class="roQuickStart"></div></div><div id="roGuideActions"><button class="roGuideAction" id="roGuideTourStart" type="button">✨ Take the 30-second tour</button><button class="roGuideAction" id="roGuideBack" type="button" hidden>← Back</button><button class="roGuideAction primary" id="roGuideNext" type="button" hidden>Next →</button></div>`;
  document.body.append(trigger, dialog);
  const find = id => dialog.querySelector('#' + id);
  const input = find('roGuideInput');
  const categories = find('roGuideCategories');
  const list = find('roGuideGrid');
  let category = 'All';let step = 0;let mode = 'finder';
  const route = item => item[3];
  function card(item) {
    const a = document.createElement('a');
    a.href = route(item);
    a.setAttribute('aria-label','Open ' + item[1]);
    a.addEventListener('click',navigateToFeature);
    const strong = document.createElement('strong');strong.textContent = item[0] + ' ' + item[1];
    const hint = document.createElement('span');hint.textContent = item[2];
    a.append(strong,hint);return a;
  }
  function navigateToFeature(event) {
    const href = event.currentTarget.getAttribute('href') || '';
    const match = /^\/#([a-z]+)$/.exec(href);
    if (!match) return;
    event.preventDefault();
    close();
    if (typeof window.go === 'function') {
      window.go(match[1]);
      return;
    }
    try { sessionStorage.setItem('ro_guide_target_20261025',match[1]); } catch {}
    window.location.assign('/');
  }
  const groups = ['All','Create','Video','Audio','Library','Explore','Account'];
  for (const group of groups) {
    const button = document.createElement('button');
    button.type = 'button';button.textContent = group;
    button.setAttribute('aria-pressed',group === 'All' ? 'true' : 'false');
    button.onclick = () => {category = group;categories.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',String(b === button)));renderFinder();};
    categories.append(button);
  }
  function renderFinder() {
    const q = input.value.trim().toLowerCase();
    const results = links.filter(item => (category === 'All' || item[4] === category) &&
      (!q || (item[1] + ' ' + item[2] + ' ' + item[5]).toLowerCase().includes(q)));
    list.replaceChildren(...results.map(card));
    find('roGuideEmpty').hidden = results.length > 0;
  }
  input.addEventListener('input',renderFinder);
  function renderTour() {
    const current = journeys[step];
    find('roGuideStepName').textContent = current.name;
    find('roGuideStepTitle').textContent = current.title;
    find('roGuideStepBody').textContent = current.body;
    const steps = find('roGuideSteps');steps.replaceChildren();
    journeys.forEach((_,index) => {
      const button = document.createElement('button');
      button.textContent = String(index + 1);button.type = 'button';
      button.setAttribute('aria-label','Tour step ' + (index + 1));
      if (step === index)button.setAttribute('aria-current','step');
      button.onclick = () => {step = index;renderTour();};steps.append(button);
    });
    find('roGuideTourLinks').replaceChildren(...current.tasks.map(i => card(links[i])));
    find('roGuideBack').hidden = step === 0;
    find('roGuideNext').textContent = step === journeys.length - 1 ? '✓ Finish' : 'Next →';
  }
  function setMode(next) {
    mode = next;
    find('roGuideFinder').hidden = mode !== 'finder';
    find('roGuideTour').hidden = mode !== 'tour';
    find('roGuideTourStart').hidden = mode !== 'finder';
    find('roGuideBack').hidden = mode !== 'tour' || step === 0;
    find('roGuideNext').hidden = mode !== 'tour';
    if (mode === 'tour')renderTour();else renderFinder();
  }
  function markSeen() {try {localStorage.setItem('ro_feature_guide_seen_20261025','1');}catch {} document.getElementById('roGuideNudge')?.remove();}
  function open(tour = false) {
    markSeen();step = 0;setMode(tour ? 'tour' : 'finder');
    if (typeof dialog.showModal === 'function')dialog.showModal();else dialog.setAttribute('open','');
    if (!tour)input.focus();
  }
  function close() {if (typeof dialog.close === 'function' && dialog.open)dialog.close();else dialog.removeAttribute('open');trigger.focus();}
  trigger.onclick = () => open(false);
  find('roGuideClose').onclick = close;
  find('roGuideTourStart').onclick = () => {step = 0;setMode('tour');};
  find('roGuideBack').onclick = () => {step = Math.max(0,step - 1);renderTour();};
  find('roGuideNext').onclick = () => {if (step === journeys.length - 1) {setMode('finder');return;}step++;renderTour();};
  dialog.addEventListener('click',event => {if (event.target === dialog)close();});
  window.roOpenFeatureGuide = open;
  // The SPA rerenders #root: restore home shortcuts without copying full tools into pages.
  const root = document.getElementById('root');
  function shortcutBar() {
    const hero = root?.querySelector('.hero-actions');
    if (!hero || root.querySelector('.roQuickStart'))return;
    const bar = document.createElement('nav');bar.className = 'roQuickStart';bar.setAttribute('aria-label','Quick feature shortcuts');
    const label = document.createElement('strong');label.textContent = 'Start here →';bar.append(label);
    for (const index of [0,2,4,7,8]) {
      const item = links[index];const a = document.createElement('a');a.href = route(item);a.textContent = item[0] + ' ' + item[1];a.addEventListener('click',navigateToFeature);bar.append(a);
    }
    hero.after(bar);
  }
  function addSingNavigation() {
    const nav=root?.querySelector('.desktop-nav');
    if (nav && !nav.querySelector('[data-sing-link]')) {
      const link=document.createElement('a');link.href='/sing-your-song';link.textContent='🎙 Sing Your Song';
      link.className='navlink';link.dataset.singLink='true';nav.append(link);
    }
  }
  if (root && 'MutationObserver' in window) {const update=()=>{shortcutBar();addSingNavigation();};const observer = new MutationObserver(update);observer.observe(root,{childList:true});update();}
  function restoreGuideDestination() {
    if (typeof window.go !== 'function') return;
    let destination = null;
    try {destination = sessionStorage.getItem('ro_guide_target_20261025');sessionStorage.removeItem('ro_guide_target_20261025');} catch {}
    if (destination && /^(studio|projects|downloads|profile|match|community|listen|help)$/.test(destination)) {
      window.go(destination);
    }
  }
  if (window.roBackendReady) restoreGuideDestination();
  else window.addEventListener('ro-backend-ready',restoreGuideDestination,{once:true});
  let seen = false;try {seen = localStorage.getItem('ro_feature_guide_seen_20261025') === '1';}catch {}
  if (!seen) setTimeout(() => {
    if (document.getElementById('roGuideNudge'))return;
    const nudge = document.createElement('aside');nudge.id = 'roGuideNudge';
    nudge.setAttribute('aria-label','First-time RhymeOrbit guide');
    const title = document.createElement('strong');title.textContent = '✨ New here? Welcome!';
    const subtitle = document.createElement('span');subtitle.textContent = '30 seconds mein website samjho. Your first song is just a few taps away.';
    const row = document.createElement('div');row.className = 'row';
    const start = document.createElement('button');start.textContent = 'Show me around';start.onclick = () => open(true);
    const later = document.createElement('button');later.textContent = 'Maybe later';later.onclick = markSeen;
    row.append(start,later);nudge.append(title,subtitle,row);document.body.append(nudge);
  },1150);
})();
