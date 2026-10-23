/* RhymeOrbit Memberships: one pricing dialog; navigation belongs to authenticated header. */
(function(){
'use strict';
const plans=[
 {name:'Free',monthly:0,annual:0,credits:300,songs:3,tag:'Start your orbit',perks:['Unlimited AI lyrics & Shayari (provider limits apply)','Community & Vibe Match','3 AI songs per calendar month']},
 {name:'Premium',monthly:599,annual:549,credits:3500,songs:35,tag:'Most popular',perks:['35 standard AI songs per month','Premium creator tools (coming soon)','Advanced analytics (coming soon)']},
 {name:'Pro',monthly:1299,annual:1199,credits:7500,songs:75,tag:'For serious creators',perks:['75 standard AI songs per month','Professional portfolio (coming soon)','Collaboration tools (coming soon)']}
];
let annual=false;
const css=document.createElement('style');
css.textContent=`
.ro-membership-overlay{position:fixed;inset:0;z-index:99999;background:#05040be8;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}
.ro-membership-dialog{position:relative;width:min(1030px,100%);max-height:92vh;overflow:auto;background:radial-gradient(ellipse at top,#51375c55,transparent 50%),#111116;color:#f9f7fb;border:1px solid #ffffff28;border-radius:24px;padding:clamp(20px,4vw,38px);box-shadow:0 30px 100px #000b}
.ro-membership-dialog h2{font:800 clamp(26px,4vw,43px)/1.1 Manrope,sans-serif;margin:14px 0;letter-spacing:-1px}
.ro-membership-muted{color:#b3aebe;font-size:13px;line-height:1.65}
.ro-membership-close{position:absolute;top:15px;right:16px;background:#ffffff12;border:1px solid #ffffff33;border-radius:50%;width:38px;height:38px;color:white;font-size:24px;cursor:pointer}
.ro-membership-cycle{display:flex;justify-content:center;gap:8px;margin:22px 0;flex-wrap:wrap}
.ro-membership-cycle button{border:1px solid #ffffff30;border-radius:30px;background:#ffffff0c;color:white;padding:10px 17px;cursor:pointer}
.ro-membership-cycle button[aria-pressed="true"]{background:#e5c9a2;color:#171118;font-weight:800}
.ro-membership-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.ro-membership-card{background:#ffffff08;border:1px solid #ffffff2a;border-radius:18px;padding:22px}
.ro-membership-card:nth-child(2){border:2px solid #b18be9}.ro-membership-card:nth-child(3){border-color:#e5c9a2}
.ro-membership-card h3{font-size:22px;margin:10px 0}.ro-membership-amount{font-size:32px;font-weight:800}
.ro-membership-card ul{padding-left:18px;line-height:1.85;font-size:12px;color:#e0dbe7;min-height:110px}
.ro-membership-card button{width:100%;padding:12px;border-radius:24px;border:1px solid #b18be9;background:#b18be9;color:#140d1e;font-weight:800}
.ro-membership-card button:disabled{opacity:.65;cursor:not-allowed}
@media(max-width:720px){.ro-membership-grid{grid-template-columns:1fr}.ro-membership-card ul{min-height:0}}
`;
document.head.appendChild(css);
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
async function showBalance(){
 const el=document.getElementById('roMembershipBalance');
 if(!el)return;
 try{
  const client=(typeof sb!=='undefined'&&sb?.auth)?sb:window.sb;
  if(!client?.auth)return;
  const result=await client.auth.getSession();
  const token=result?.data?.session?.access_token;
  if(!token)return;
  const response=await fetch('/api/music/credits',{headers:{Authorization:'Bearer '+token}});
  if(!response.ok)return;
  const data=await response.json();
  if(Number.isFinite(data.remaining)&&Number.isFinite(data.monthlyLimit)){
   el.textContent='Your plan: '+String(data.plan||'free').toUpperCase()+' · '+Math.max(0,data.remaining)+' of '+data.monthlyLimit+' songs remaining this month';
  }
 }catch(e){console.warn('Membership balance unavailable',e)}
}
function openMemberships(reason){
 if(typeof state==='undefined'||!state.user)return;
 document.getElementById('roMembershipOverlay')?.remove();
 const overlay=document.createElement('div');
 overlay.id='roMembershipOverlay';overlay.className='ro-membership-overlay';
 overlay.innerHTML=`<section class="ro-membership-dialog" role="dialog" aria-modal="true" aria-labelledby="roMembershipTitle">
 <button class="ro-membership-close" type="button" aria-label="Close memberships">×</button>
 <div style="text-align:center"><div style="font-size:11px;letter-spacing:3px;color:#e5c9a2">RHYMEORBIT MEMBERSHIPS</div>
 <h2 id="roMembershipTitle">${reason==='limit'?'Your free song limit is reached 🎵':'Find your next sound ✦'}</h2>
 <p class="ro-membership-muted">Create music, connect with creators and grow your orbit.</p>
 <p id="roMembershipBalance" class="ro-membership-muted" aria-live="polite">Checking your song balance…</p></div>
 <div class="ro-membership-cycle"><button type="button" data-cycle="monthly" aria-pressed="${!annual}">Monthly</button><button type="button" data-cycle="annual" aria-pressed="${annual}">Annual · Save up to 8%</button></div>
 <div class="ro-membership-grid">${plans.map((p,i)=>`<article class="ro-membership-card"><div style="color:#e5c9a2;font-size:11px">${escapeHTML(p.tag)}</div><h3>${escapeHTML(p.name)}</h3>
 <div class="ro-membership-amount">₹${annual?p.annual:p.monthly}<small style="font-size:13px;color:#b3aebe">/mo</small></div>
 <p class="ro-membership-muted">${annual&&p.annual?'₹'+p.annual*12+' billed annually':'Monthly membership'}</p>
 <p><strong>${p.credits.toLocaleString('en-IN')} credits</strong> / month<br><span class="ro-membership-muted">≈ ${p.songs} standard songs (100 credits/song)</span></p>
 <ul>${p.perks.map(x=>'<li>'+escapeHTML(x)+'</li>').join('')}</ul><button type="button" disabled>${i===0?'Free plan':'Checkout coming soon'}</button></article>`).join('')}</div>
 <p class="ro-membership-muted" style="text-align:center;margin-top:20px">Plans are a preview. Payments are not enabled. Paid credits and benefits require verified provider capacity, billing and server-side entitlements. Annual pricing is billed yearly with monthly credit refresh.</p></section>`;
 document.body.appendChild(overlay);
 overlay.querySelector('.ro-membership-close').onclick=()=>overlay.remove();
 overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
 overlay.querySelectorAll('[data-cycle]').forEach(b=>b.onclick=()=>{annual=b.dataset.cycle==='annual';openMemberships(reason)});
 overlay.querySelector('.ro-membership-close').focus();
 showBalance();
}
window.roOpenPricing=openMemberships;
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('roMembershipOverlay')?.remove()});
})();
