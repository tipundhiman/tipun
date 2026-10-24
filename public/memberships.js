/* RhymeOrbit Memberships: one pricing dialog; navigation belongs to authenticated header. */
(function(){
'use strict';
const plans=[
 {name:'Free',monthly:0,annual:0,credits:300,songs:3,tag:'Start your orbit',perks:['Unlimited AI lyrics & Shayari (provider limits apply)','Community & Vibe Match','3 AI songs per calendar month']},
 {name:'Premium',monthly:599,annual:549,credits:3500,songs:35,tag:'Most popular',perks:['35 standard AI songs per month','Paid creator tools are not active','Paid analytics are not active']},
 {name:'Pro',monthly:1299,annual:1199,credits:7500,songs:75,tag:'For serious creators',perks:['75 standard AI songs per month','Paid portfolio tools are not active','Paid collaboration tools are not active']}
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
 const unavailable=()=>{if(document.getElementById('roMembershipBalance')===el)el.textContent='Song balance unavailable right now; please try again later.'};
 try{
  const client=(typeof sb!=='undefined'&&sb?.auth)?sb:window.sb;
  if(!client?.auth){unavailable();return;}
  const result=await client.auth.getSession();
  const token=result?.data?.session?.access_token;
  if(!token){unavailable();return;}
  const response=await fetch('/api/music/credits',{headers:{Authorization:'Bearer '+token}});
  if(!response.ok){unavailable();return;}
  const data=await response.json();
  if(Number.isFinite(data.remaining)&&Number.isFinite(data.monthlyLimit)){
   el.textContent='Your plan: '+String(data.plan||'free').toUpperCase()+' · '+Math.max(0,data.remaining)+' of '+data.monthlyLimit+' songs remaining this month';
  }else unavailable();
 }catch(e){unavailable();console.warn('Membership balance unavailable',e)}
}

async function sandboxAuthToken(){
 const client=(typeof sb!=='undefined'&&sb?.auth)?sb:window.sb;
 const session=await client?.auth?.getSession();
 return session?.data?.session?.access_token||null;
}
async function sandboxRequest(endpoint,payload){
 const token=await sandboxAuthToken();
 if(!token)throw Error('Please log in again to test Razorpay.');
 const response=await fetch('/api/billing/test/'+endpoint,{
  ...(payload?{method:'POST',body:JSON.stringify(payload)}:{}),
  headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})}
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Sandbox request failed.');
 return result;
}
function razorpaySDK(){
 if(window.Razorpay)return Promise.resolve(window.Razorpay);
 if(window.roRazorpaySDKPromise)return window.roRazorpaySDKPromise;
 window.roRazorpaySDKPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://checkout.razorpay.com/v1/checkout.js';
  script.async=true;
  script.onload=()=>window.Razorpay?resolve(window.Razorpay):reject(Error('Razorpay sandbox could not load.'));
  script.onerror=()=>reject(Error('Razorpay checkout script is unavailable.'));
  document.head.append(script);
 });
 return window.roRazorpaySDKPromise;
}
async function launchRazorpaySandbox(plan,cycle,button,status){
 if(button.disabled)return;
 button.disabled=true;
 status.textContent='Creating a Razorpay TEST subscription…';
 try{
  const data=await sandboxRequest('create-subscription',{plan,cycle});
  if(!data.testMode)throw Error('Test mode verification failed. Checkout refused.');
  const Razorpay=await razorpaySDK();
  status.textContent='Sandbox checkout is ready. No real payment will be collected.';
  const checkout=new Razorpay({
   key:data.keyId,
   subscription_id:data.subscriptionId,
   name:'RhymeOrbit · TEST MODE',
   description:plan.toUpperCase()+' '+cycle+' sandbox subscription. No real charges.',
   theme:{color:'#dcb890'},
   handler:async response=>{
    status.textContent='Verifying test authorization…';
    try{
     const verified=await sandboxRequest('verify',response);
     status.textContent=verified.verified?
      '✓ Test authorization verified. No paid credits were granted. Check test webhooks.':
      'Sandbox verification incomplete. No paid credits were granted.';
    }catch(err){status.textContent=err.message||'Test authorization verification failed.'}
   },
   modal:{ondismiss:()=>{status.textContent='Sandbox checkout closed. No paid credits were granted.'}}
  });
  checkout.open();
 }catch(err){status.textContent=err.message||'Sandbox checkout unavailable.'}
 finally{button.disabled=false}
}
async function loadSandboxControls(overlay){
 try{
  const status=await sandboxRequest('status');
  if(!status.testMode||!status.databaseReady)return;
  if(!document.body.contains(overlay))return;
  const panel=document.createElement('section');
  panel.className='ro-membership-test-panel';
  panel.style.cssText='margin-top:20px;padding:16px;border:1px dashed #e5c9a27a;border-radius:15px;';
  const heading=document.createElement('strong');
  heading.textContent='🧪 Admin-only Razorpay Sandbox';
  const note=document.createElement('p');note.className='ro-membership-muted';
  note.textContent='Test transactions only. Live checkout remains disabled for everyone and test payments never grant paid credits.';
  panel.append(heading,note);
  const diagnose=document.createElement('button');
  diagnose.type='button';
  diagnose.className='ro-membership-test-button';
  diagnose.textContent='↻ Check Razorpay TEST connection';
  diagnose.style.cssText='margin:5px 10px 14px 0;padding:10px 15px;border-radius:24px;border:1px solid #e5c9a2;background:#251f2c;color:#f7e6c6;cursor:pointer;';
  const diagnosticLines=document.createElement('div');
  diagnosticLines.className='ro-membership-muted';
  diagnosticLines.setAttribute('role','status');
  diagnosticLines.setAttribute('aria-live','polite');
  diagnosticLines.style.cssText='white-space:pre-line;margin-bottom:12px;';
  diagnose.onclick=async()=>{
   if(diagnose.disabled)return;
   diagnose.disabled=true;diagnosticLines.textContent='Checking Razorpay TEST connection without making any payment…';
   try{
    const diagnosis=await sandboxRequest('diagnose');
    const list=diagnosis.plans||[];
    const lines=[diagnosis.message];
    if(!diagnosis.settings?.keyIdHasTestPrefix)lines.push('• TEST Key ID missing/invalid in Production environment.');
    if(!diagnosis.settings?.apiSecretSet)lines.push('• TEST API Secret missing in Production environment.');
    if(!diagnosis.settings?.webhookSecretSet)lines.push('• Test webhook secret missing.');
    if(!diagnosis.settings?.databaseReady)lines.push('• Sandbox database not ready.');
    for(const item of list)lines.push('• '+item.plan.toUpperCase()+' '+item.cycle+': '+item.result);
    diagnosticLines.textContent=lines.join('\n');
   }catch(error){diagnosticLines.textContent=error.message||'Connection check unavailable. Sign in as admin.'}
   finally{diagnose.disabled=false}
  };
  panel.append(diagnose,diagnosticLines);
  const result=document.createElement('p');result.className='ro-membership-muted';
  result.setAttribute('role','status');result.setAttribute('aria-live','polite');
  if(!status.configured){
   result.textContent='Set your Razorpay TEST keys, webhook secret and plan IDs in the server environment to enable sandbox checkout.';
  }else{
   for(const plan of ['premium','pro']){
    const cycle=annual?'annual':'monthly';
    if(!status.availablePlans?.[plan]?.[cycle])continue;
    const btn=document.createElement('button');btn.type='button';
    btn.className='ro-membership-test-button';
    btn.textContent='Test '+plan.charAt(0).toUpperCase()+plan.slice(1)+' '+cycle+' checkout';
    btn.style.cssText='margin:5px 10px 5px 0;padding:10px 15px;border-radius:24px;border:1px solid #e5c9a2;background:#251f2c;color:#f7e6c6;cursor:pointer;';
    btn.onclick=()=>launchRazorpaySandbox(plan,cycle,btn,result);
    panel.append(btn);
   }
   result.textContent='Choose a sandbox subscription. No real money moves.';
  }
  panel.append(result);
  overlay.querySelector('.ro-membership-dialog')?.append(panel);
 }catch(err){
  // Non-admin users get no sandbox controls and no exposed billing configuration.
 }
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
 <ul>${p.perks.map(x=>'<li>'+escapeHTML(x)+'</li>').join('')}</ul><button type="button" disabled>${i===0?'Free plan':'Checkout unavailable'}</button></article>`).join('')}</div>
 <p class="ro-membership-muted" style="text-align:center;margin-top:20px">Free includes 3 songs/month when generation is available. Paid plans are not currently purchasable. Paid credits and benefits require verified provider capacity, billing and server-side entitlements. Annual pricing is billed yearly with monthly credit refresh.</p></section>`;
 document.body.appendChild(overlay);
 overlay.querySelector('.ro-membership-close').onclick=()=>overlay.remove();
 overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
 overlay.querySelectorAll('[data-cycle]').forEach(b=>b.onclick=()=>{annual=b.dataset.cycle==='annual';openMemberships(reason)});
 overlay.querySelector('.ro-membership-close').focus();
 showBalance();
 loadSandboxControls(overlay);
}
window.roOpenPricing=openMemberships;
window.roCloseMemberships=()=>document.getElementById('roMembershipOverlay')?.remove();
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('roMembershipOverlay')?.remove()});
})();
