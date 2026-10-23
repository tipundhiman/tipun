/* RhymeOrbit membership preview. Checkout intentionally disabled until verified billing. */
(function(){
'use strict';
const plans=[
 {name:'Free',monthly:0,annual:0,credits:300,songs:3,tag:'Start your orbit',perks:['AI lyrics & Shayari','Community & Vibe Match','3 AI songs / month']},
 {name:'Premium',monthly:599,annual:549,credits:3500,songs:35,tag:'Most popular',perks:['35 standard AI songs / month','Premium creator tools (coming soon)','Advanced analytics (coming soon)']},
 {name:'Pro',monthly:1299,annual:1199,credits:7500,songs:75,tag:'For serious creators',perks:['75 standard AI songs / month','Professional portfolio (coming soon)','Collaboration tools (coming soon)']}
];
let annual=false;
const style=document.createElement('style');
style.textContent=`
.ro-price-backdrop{position:fixed;inset:0;z-index:99999;background:#05040bdf;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto}
.ro-price-dialog{position:relative;width:min(1040px,100%);max-height:94vh;overflow:auto;background:radial-gradient(ellipse at 50% 0%,#51375c55,transparent 48%),#111116;border:1px solid #ffffff28;border-radius:24px;padding:clamp(20px,4vw,38px);color:#faf8ff;box-shadow:0 30px 100px #000b}
.ro-price-dialog h2{font:700 clamp(28px,4vw,46px)/1.1 Manrope,sans-serif;letter-spacing:-1.5px;margin:12px 0}
.ro-price-muted{color:#aaa5b5;font-size:13px;line-height:1.6}.ro-price-close{position:absolute;right:18px;top:15px;border:1px solid #ffffff33;background:#ffffff12;color:white;border-radius:50%;width:36px;height:36px;font-size:22px}
.ro-price-toggle{display:flex;gap:8px;justify-content:center;margin:22px 0}.ro-price-toggle button{border:1px solid #ffffff25;border-radius:40px;background:#ffffff0b;color:white;padding:10px 18px}.ro-price-toggle button[aria-pressed=true]{background:#b292ed;color:#130d1d;font-weight:800}
.ro-price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.ro-price-card{border:1px solid #ffffff24;border-radius:19px;padding:23px;background:#ffffff06}.ro-price-card.popular{border:2px solid #ac7cff;background:#ac7cff10}.ro-price-card.pro{border-color:#d3ae77}.ro-price-card h3{font-size:22px;margin:9px 0}.ro-price-amount{font:800 32px Manrope,sans-serif}.ro-price-card ul{padding-left:18px;line-height:2;color:#e4ddea;font-size:12px}.ro-price-card button{width:100%;margin-top:14px;border-radius:30px;border:1px solid #b897f5;background:#9b76e0;color:#110b1c;padding:13px;font-weight:800}.ro-price-card button:disabled{opacity:.65;cursor:not-allowed}.ro-price-foot{margin-top:18px;color:#a6a0b0;font-size:12px;line-height:1.6;text-align:center}
@media(max-width:700px){.ro-price-grid{grid-template-columns:1fr}.ro-price-dialog{max-height:94vh}.ro-price-card{padding:18px}}
`;
document.head.appendChild(style);
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(reason){
 if(!window.roMembershipSignedIn)return;
 const previous=document.getElementById('roPricingBackdrop');if(previous)previous.remove();
 const wrap=document.createElement('div');wrap.id='roPricingBackdrop';wrap.className='ro-price-backdrop';
 wrap.innerHTML=`<section class="ro-price-dialog" role="dialog" aria-modal="true" aria-labelledby="roPriceTitle">
 <button type="button" class="ro-price-close" aria-label="Close pricing">×</button>
 <div style="text-align:center"><div style="font-size:11px;letter-spacing:3px;color:#e5c9a2">RHYMEORBIT MEMBERSHIPS</div>
 <h2 id="roPriceTitle">${reason==='limit'?'Your 3 free songs are used 🎵':'Find your next sound ✦'}</h2>
 <p class="ro-price-muted">${reason==='limit'?'You can keep enjoying our community and writing tools. Explore plans for more music.':'Create music, connect with creators and grow your orbit.'}</p></div>
 <p id="roLiveUsage" class="ro-price-muted" style="text-align:center" aria-live="polite">Sign in to see your actual song balance.</p>\n <div class="ro-price-toggle"><button type="button" data-cycle="monthly" aria-pressed="${!annual}">Monthly</button><button type="button" data-cycle="annual" aria-pressed="${annual}">Annual · Save up to 8%</button></div>
 <div class="ro-price-grid">${plans.map((p,i)=>`<article class="ro-price-card ${i===1?'popular':i===2?'pro':''}"><div style="color:#e5c9a2;font-size:11px">${esc(p.tag)}</div><h3>${esc(p.name)}</h3><div class="ro-price-amount">₹${annual?p.annual:p.monthly}<small style="font-size:13px;color:#aaa5b5">/mo</small></div>
 <p class="ro-price-muted">${annual&&p.annual?'₹'+p.annual*12+' billed yearly':'Monthly membership'}</p><p><strong>${p.credits.toLocaleString('en-IN')} credits</strong> / month<br><span class="ro-price-muted">≈ ${p.songs} standard songs (100 credits each)</span></p>
 <ul>${p.perks.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
 <button type="button" disabled>${i===0?'Free plan':'Checkout coming soon'}</button></article>`).join('')}</div>
 <p id="roLaunchReadiness" class="ro-price-foot" aria-live="polite">Checking music generation availability…</p>
 <p class="ro-price-foot">Preview only — payments are not enabled. Song credits and paid benefits activate only after provider capacity, billing and entitlements are verified. Annual plans renew credits monthly. Future features are labeled Coming Soon.</p>
 </section>`;
 document.body.appendChild(wrap);\n loadUsage();
 fetch('/api/music/status').then(r=>r.ok?r.json():null).then(d=>{
   const el=wrap.querySelector('#roLaunchReadiness');
   if(el)el.textContent=d?.message||'Music generation availability could not be verified.';
 }).catch(()=>{const el=wrap.querySelector('#roLaunchReadiness');if(el)el.textContent='Music generation availability could not be verified.';});
 wrap.querySelector('.ro-price-close').onclick=()=>wrap.remove();
 wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove()});
 wrap.querySelectorAll('[data-cycle]').forEach(b=>b.onclick=()=>{annual=b.dataset.cycle==='annual';render(reason)});
 wrap.querySelector('.ro-price-close').focus();
}
/* Read actual monthly usage from the authenticated backend; never trust browser-stored plan data. */
async function loadUsage(){
 let token=null;
 try{
   if(typeof sb!=='undefined'&&sb){const session=await sb.auth.getSession();token=session.data.session?.access_token}
 }catch{}
 if(!token)return;
 try{
   const response=await fetch('/api/music/credits',{headers:{Authorization:'Bearer '+token}});
   if(!response.ok)return;
   const usage=await response.json();
   if(!Number.isFinite(usage.monthlyLimit)||!Number.isFinite(usage.remaining))return;
   const count=document.getElementById('roLiveUsage');
   if(count){
     count.textContent='Your current plan: '+String(usage.plan||'free').toUpperCase()+
       ' · '+Math.max(0,usage.remaining)+' of '+usage.monthlyLimit+' songs remaining this month.';
   }
   const badge=document.getElementById('roMembershipUsage');
   if(badge)badge.textContent=Math.max(0,usage.remaining)+'/'+usage.monthlyLimit+' songs left';
 }catch{}
}
window.roOpenPricing=render;
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('roPricingBackdrop')?.remove()});
/* Add an always-accessible upgrade entry without changing existing navigation handlers. */
const entry=document.createElement('button');entry.type='button';entry.textContent='✦ Memberships';entry.setAttribute('aria-label','Explore RhymeOrbit memberships');
entry.style.cssText='position:fixed;bottom:18px;left:18px;z-index:1100;border:1px solid #b18be9;background:#20162d;color:#f4e7ff;padding:11px 16px;border-radius:30px;font-weight:700;box-shadow:0 8px 26px #0008';
entry.onclick=()=>{if(window.roMembershipSignedIn)render('plans')};entry.hidden=true;document.body.appendChild(entry);
function membershipVisibility(){
 const signedIn=Boolean(window.roMembershipSignedIn);
 entry.hidden=!signedIn;
 const badge=document.getElementById('roMembershipUsage');
 if(badge)badge.hidden=!signedIn;
 if(!signedIn)document.getElementById('roPricingBackdrop')?.remove();
}
window.roRefreshMembershipVisibility=membershipVisibility;
membershipVisibility();
const usageBadge=document.createElement('div');usageBadge.id='roMembershipUsage';
usageBadge.style.cssText='position:fixed;bottom:18px;left:185px;z-index:1099;border:1px solid #ffffff29;background:#17141d;color:#d8c9ed;padding:11px;border-radius:30px;font-size:12px;pointer-events:none';
usageBadge.textContent='';usageBadge.hidden=true;document.body.appendChild(usageBadge);membershipVisibility();
let authListenerAttached=false;
async function syncMembershipAuth(){
 try{
  const client=window.sb;
  if(!client?.auth)return;
  const {data,error}=await client.auth.getSession();
  if(error)return;
  window.roMembershipSignedIn=Boolean(data?.session?.access_token);
  membershipVisibility();
  if(window.roMembershipSignedIn)loadUsage();
  if(!authListenerAttached){
   authListenerAttached=true;
   client.auth.onAuthStateChange((_event,session)=>{
    window.roMembershipSignedIn=Boolean(session?.access_token);
    membershipVisibility();
    if(session?.access_token)loadUsage();
   });
  }
 }catch(e){console.warn('Membership auth check failed',e)}
}
syncMembershipAuth();
let authRetryCount=0;
const authRetry=setInterval(()=>{
 if(authListenerAttached||authRetryCount++>=20){clearInterval(authRetry);return}
 syncMembershipAuth();
},500);
window.addEventListener('focus',syncMembershipAuth);
loadUsage();
/* The music endpoint is the source of truth. Surface the upgrade when it rejects quota. */
const originalFetch=window.fetch.bind(window);
window.fetch=async function(input,init){const response=await originalFetch(input,init);try{
 const url=typeof input==='string'?input:input?.url||'';
 if(window.roMembershipSignedIn&&url.includes('/api/music/generate')&&[402,403,429].includes(response.status)){
   const data=await response.clone().json().catch(()=>({}));
   if(/limit|quota|credits|songs used|monthly/i.test(String(data.error||'')))queueMicrotask(()=>render('limit'));
 }
}catch{}return response;};
})();