/* RhymeOrbit Creator Kit beta: local-only EPK and themes. No paid entitlement implied. */
(function(){
'use strict';
const styles=document.createElement('style');
styles.textContent=`
.ro-kit-shade{position:fixed;inset:0;z-index:99998;background:#030309e8;display:grid;place-items:center;padding:16px;overflow:auto}
.ro-kit-panel{width:min(690px,100%);max-height:94vh;overflow:auto;border:1px solid #ad8af15c;border-radius:22px;background:#15131c;padding:28px;color:#f9f6ff;box-shadow:0 20px 80px #000b}
.ro-kit-panel h2{margin:8px 0;font:750 30px Manrope,sans-serif}.ro-kit-panel label{display:block;margin:14px 0 6px;color:#d6cfe0;font-size:12px;font-weight:700}
.ro-kit-panel input,.ro-kit-panel textarea,.ro-kit-panel select{width:100%;border-radius:10px;border:1px solid #ffffff35;background:#090a10;color:white;padding:12px;font:inherit}
.ro-kit-panel textarea{min-height:105px;resize:vertical}.ro-kit-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.ro-kit-actions button{border:1px solid #b99be7;border-radius:28px;padding:11px 16px;background:#9e81dc;color:#110b1b;font-weight:800}
.ro-kit-actions button.secondary{background:#ffffff0a;color:white}.ro-kit-help{color:#b5aebb;font-size:12px;line-height:1.6}
`;document.head.appendChild(styles);
const escapeHtml=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function open(){
 document.getElementById('roCreatorKit')?.remove();
 const user=typeof state!=='undefined'?state.user:null;
 if(!user){if(typeof openAuth==='function')openAuth('login');return;}
 const el=document.createElement('div');el.id='roCreatorKit';el.className='ro-kit-shade';
 el.innerHTML=`<section class="ro-kit-panel" role="dialog" aria-modal="true" aria-labelledby="roKitTitle">
 <div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div><small style="color:#dfc49b;letter-spacing:2px">RHYMEORBIT CREATOR KIT · BETA</small><h2 id="roKitTitle">Your artist press kit ✦</h2></div><button class="secondary" id="roKitClose" aria-label="Close" style="background:none;border:0;color:white;font-size:28px">×</button></div>
 <p class="ro-kit-help">Make a beautiful, downloadable EPK/portfolio. Your edits stay in this browser until exported. Beta access is free while we build secure membership entitlements.</p>
 <label for="roKitName">Artist name</label><input id="roKitName" maxlength="80" value="${escapeHtml(user.name||'')}">
 <label for="roKitBio">Artist bio</label><textarea id="roKitBio" maxlength="1200" placeholder="Tell listeners about your sound...">${escapeHtml(user.bio||'')}</textarea>
 <label for="roKitGenre">Genre / sound</label><input id="roKitGenre" maxlength="120" placeholder="Indie pop • Haryanvi • Hip-hop">
 <label for="roKitLink">Your music or social link (https://)</label><input id="roKitLink" maxlength="500" placeholder="https://...">
 <label for="roKitTheme">Portfolio theme</label><select id="roKitTheme"><option value="violet">Orbit Violet</option><option value="gold">Golden Hour</option><option value="cyan">Neon Wave</option></select>
 <div class="ro-kit-actions"><button id="roKitExport">↓ Download EPK</button><button class="secondary" id="roKitPreview">Preview</button></div>
 <p id="roKitStatus" class="ro-kit-help" role="status"></p>
 </section>`;
 document.body.appendChild(el);
 const $=id=>el.querySelector('#'+id);
 $('roKitClose').onclick=()=>el.remove();el.addEventListener('click',e=>{if(e.target===el)el.remove()});
 function build(){
 const name=$('roKitName').value.trim(),bio=$('roKitBio').value.trim(),genre=$('roKitGenre').value.trim(),raw=$('roKitLink').value.trim(),theme=$('roKitTheme').value;
 if(!name){$('roKitStatus').textContent='Please enter your artist name.';return null}
 let link='';if(raw){try{const u=new URL(raw);if(u.protocol!=='https:')throw Error();link=u.href}catch{$('roKitStatus').textContent='Please use a valid https:// link.';return null}}
 const colors={violet:['#100e19','#bda1ff'],gold:['#17120c','#f0c58c'],cyan:['#071619','#86ece5']};const [bg,accent]=colors[theme];
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(name)} — Artist EPK</title><style>body{margin:0;background:${bg};color:#faf9f7;font:16px/1.7 system-ui,sans-serif}main{max-width:750px;margin:10vh auto;padding:35px}small{color:${accent};letter-spacing:3px}h1{font-size:clamp(42px,8vw,85px);line-height:1.1;letter-spacing:-3px;margin:25px 0}h2{color:${accent}}p{white-space:pre-wrap}a{color:${accent}}.line{border-top:1px solid #ffffff35;margin:35px 0}</style><main><small>RHYMEORBIT ✦ ARTIST PRESS KIT</small><h1>${escapeHtml(name)}</h1><h2>${escapeHtml(genre||'Independent music creator')}</h2><div class="line"></div><p>${escapeHtml(bio||'Creating a new sound. More to come.')}</p>${link?'<p><a rel="noopener noreferrer" href="'+escapeHtml(link)+'">Listen & connect ↗</a></p>':''}<div class="line"></div><small>Created with RhymeOrbit Creator Kit</small></main></html>`;
 }
 $('roKitPreview').onclick=()=>{const html=build();if(!html)return;const blob=new Blob([html],{type:'text/html'});const url=URL.createObjectURL(blob);const win=window.open(url,'_blank','noopener,noreferrer');if(!win)$('roKitStatus').textContent='Allow popups to preview, or use Download EPK.';setTimeout(()=>URL.revokeObjectURL(url),60000)};
 $('roKitExport').onclick=()=>{const html=build();if(!html)return;const blob=new Blob([html],{type:'text/html'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rhymeorbit-artist-epk.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);$('roKitStatus').textContent='EPK exported. You can share the downloaded HTML file.'};
 $('roKitName').focus();
}
window.roOpenCreatorKit=open;
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('roCreatorKit')?.remove()});
const button=document.createElement('button');button.type='button';button.textContent='✦ Creator Kit';button.style.cssText='position:fixed;bottom:65px;left:18px;z-index:1100;border:1px solid #d5b68b;background:#211b1c;color:#f8e4c5;padding:10px 16px;border-radius:30px;font-weight:700;box-shadow:0 8px 26px #0008';button.onclick=open;document.body.appendChild(button);
})();