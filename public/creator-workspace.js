/* Compact creator workspace UI. All backend generation and song access stay unchanged. */
(() => {
  'use strict';
  let selectedTab = 'create';
  const css = document.createElement('style');
  css.textContent = `
    .app-main:has(.ro-workspace-tabs){padding-top:24px}
    .app-main:has(.ro-workspace-tabs) .page-head{margin-bottom:14px}
    .app-main:has(.ro-workspace-tabs) .page-head h1{font-size:clamp(28px,3.4vw,41px);margin:8px 0}
    .app-main:has(.ro-workspace-tabs) .page-head p{margin:0}
    .ro-workspace-tabs{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0 20px;border-bottom:1px solid #ffffff23;padding-bottom:12px}
    .ro-workspace-tabs button{border:1px solid #e5c9a235;border-radius:999px;padding:11px 18px;background:#e5c9a20b;color:#d7d0d7;cursor:pointer;font:700 12px Manrope,system-ui,sans-serif;transition:background .2s,transform .2s}
    .ro-workspace-tabs button:hover{transform:translateY(-2px);border-color:#e5c9a280}
    .ro-workspace-tabs button[aria-selected=true]{background:linear-gradient(115deg,#ecd2ad,#e6c69c);color:#211a20}
    .ro-workspace-tabs button:focus-visible{outline:2px solid #e5c9a2;outline-offset:3px}
    .ro-workspace-content{display:block!important;max-width:870px}
    .ro-workspace-content>.panel{width:100%;margin:0}
    .ro-workspace-content>.panel[hidden]{display:none!important}
    .ro-workspace-content .ro-studio-advanced{background:#141319;padding:0 15px;border:1px solid #e5c9a230;border-radius:15px;margin:15px 0}
    .ro-studio-advanced summary{padding:14px 0;cursor:pointer;color:#e8d1ae;font-weight:750}
    .ro-studio-advanced .field,.ro-studio-advanced .formrow{margin:12px 0}
    .ro-studio-library-link{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 0 6px}
    .ro-studio-library-link button{white-space:normal}
    .ro-workspace-content .panel h3{font-size:20px}
    .ro-downloads-head{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:21px}
    .ro-downloads-head h1{font:600 clamp(33px,4vw,46px)/1.12 Manrope,system-ui,sans-serif;letter-spacing:-1.8px;margin:9px 0}
    .ro-downloads-head p{max-width:660px;color:#b7b1bf;font-size:13px;line-height:1.7;margin:0}
    .ro-downloads-list{max-width:850px}
    .ro-downloads-list .ro-song-entry{margin:9px 0;padding:15px 16px}
    .ro-song-drawer{border-top:1px solid #ffffff17;margin-top:11px}
    .ro-song-drawer>summary{list-style:none;cursor:pointer;padding:10px 2px;color:#e5c9a2;font:700 12px Manrope,system-ui,sans-serif}
    .ro-song-drawer>summary::-webkit-details-marker{display:none}
    .ro-song-drawer>summary:after{content:'⌄';float:right;font-size:15px;transition:transform .2s}
    .ro-song-drawer[open]>summary:after{transform:rotate(180deg)}
    .ro-song-drawer>summary:focus-visible{outline:2px solid #e5c9a2;outline-offset:2px}
    .ro-downloads-list .ro-song-player{margin-top:2px}
    .ro-downloads-footnote{margin:22px 0 0;max-width:750px}
    @media(max-width:760px){
      .app-main:has(.ro-workspace-tabs){padding-top:16px}
      .ro-workspace-tabs{display:grid;grid-template-columns:1fr 1fr}
      .ro-workspace-tabs button{padding:11px 9px}
      .ro-downloads-head{align-items:start}
      .ro-downloads-list .ro-song-entry{padding:12px}
      .ro-downloads-list .ro-song-head{gap:9px}
    }
    @media(prefers-reduced-motion:reduce){.ro-workspace-tabs button,.ro-song-drawer>summary:after{transition:none}}
  `;
  document.head.append(css);

  function buildTabs() {
    const editor = document.getElementById('songLyrics');
    const main = editor?.closest('.app-main');
    if (!main || main.dataset.roCompactWorkspace === 'true') return;
    const grid = main.querySelector(':scope > .grid2');
    const creator = grid?.firstElementChild;
    const aside = grid?.lastElementChild;
    const doctor = aside?.querySelector(':scope > .panel');
    if (!creator || !doctor || !editor) return;
    main.dataset.roCompactWorkspace = 'true';

    // The library now belongs exclusively to the Download Audio route.
    document.getElementById('roSongLibrary')?.remove();
    const extraGuide = aside.querySelectorAll(':scope > .panel')[1];
    extraGuide?.remove();
    doctor.remove();
    aside.remove();
    grid.append(doctor);
    grid.classList.add('ro-workspace-content');

    // Core song controls remain visible; optional metadata is one disclosure.
    const voiceField = document.getElementById('roVocalVoice')?.closest('.field');
    const formatFields = [
      document.getElementById('songGenre')?.closest('.formrow'),
      document.getElementById('songLanguage')?.closest('.field'),
      document.getElementById('roMusicStyle')?.closest('.field')
    ].filter(Boolean);
    if (voiceField && formatFields.length) {
      const advanced = document.createElement('details');
      advanced.className = 'ro-studio-advanced';
      const summary = document.createElement('summary');
      summary.textContent = '⚙ Genre, mood, language & music style';
      advanced.append(summary, ...formatFields);
      voiceField.parentNode.insertBefore(advanced, voiceField);
    }

    const generationStatus = document.getElementById('roMurekaResult');
    if (generationStatus) {
      const linkRow = document.createElement('div');
      linkRow.className = 'ro-studio-library-link';
      const link = document.createElement('button');
      link.className = 'btn sm';
      link.type = 'button';
      link.textContent = '♫ View my songs & downloads ↗';
      link.onclick = () => window.go('downloads');
      linkRow.append(link);
      generationStatus.insertAdjacentElement('afterend', linkRow);
    }

    const tabList = document.createElement('div');
    tabList.className = 'ro-workspace-tabs';
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', 'AI Studio tools');
    creator.id = 'roCreatePane';
    creator.setAttribute('role', 'tabpanel');
    doctor.id = 'roDoctorPane';
    doctor.setAttribute('role', 'tabpanel');
    const specs = [['create', '✦ Create Song', creator], ['doctor', '✧ Song Doctor', doctor]];
    const buttons = specs.map(([value, label, pane]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'roTab_' + value;
      button.textContent = label;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', pane.id);
      pane.setAttribute('aria-labelledby', button.id);
      button.addEventListener('click', () => {
        selectedTab = value;
        showTab();
      });
      tabList.append(button);
      return button;
    });
    const showTab = () => {
      specs.forEach(([value, , pane], index) => {
        const active = selectedTab === value;
        pane.hidden = !active;
        buttons[index].setAttribute('aria-selected', String(active));
        buttons[index].tabIndex = active ? 0 : -1;
      });
    };
    tabList.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      selectedTab = selectedTab === 'create' ? 'doctor' : 'create';
      showTab();
      buttons[selectedTab === 'create' ? 0 : 1].focus();
    });
    grid.insertAdjacentElement('beforebegin', tabList);
    showTab();
  }

  const previousRender = window.render;
  if (typeof previousRender === 'function') {
    window.render = function (...args) {
      const result = previousRender.apply(this, args);
      buildTabs();
      return result;
    };
  }
  buildTabs();
})();
