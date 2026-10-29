/* Real authenticated RhymeOrbit account, projects and AI integration. */
let sb=null,remoteReady=false;
// Single authenticated Gemini text endpoint for Riya, Lyrics, Shayari and Song Doctor.
// Keep session lookup, request headers and response parsing identical for every AI feature.
async function roGenerateAIText(kind,input){
 if(!sb?.auth)throw new Error('Account connection is loading. Please wait and try again.');
 const {data,error:sessionError}=await sb.auth.getSession();
 if(sessionError||!data?.session?.access_token)throw new Error('Please log in again to use AI.');
 let response;
 try{
  response=await fetch('/api/ai',{
   method:'POST',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},
   body:JSON.stringify({kind,input})
  });
 }catch{
  throw new Error('Could not connect to the AI server. Check your connection and retry.');
 }
 const payload=await response.json().catch(()=>null);
 if(!payload||typeof payload!=='object'){
  throw new Error('This deployment did not return an AI response. Please open https://rhymeorbit.in and try again.');
 }
 if(!response.ok){
  if(response.status===401)throw new Error('Your session has expired. Please log in again.');
  if(payload.error==='Server request failed'&&typeof location!=='undefined'&&/\.vercel\.app$/i.test(location.hostname||'')){
   throw new Error('This Vercel preview has an AI server error. Please open https://rhymeorbit.in and retry.');
  }
  throw new Error(String(payload.error||'AI request failed. Please try again.'));
 }
 if(typeof payload.text!=='string'||!payload.text.trim())throw new Error('AI returned an empty response. Please try again.');
 if(kind==='help')window.roLastAIProvider=payload.provider==='nvidia'?'nvidia':'gemini';
 return payload.text.trim();
}
window.roGenerateAIText=roGenerateAIText;
let sessionSync=null,sessionSyncUser=null,sessionGeneration=0;
async function initBackend(){try{const response=await fetch('/api/config');if(!response.ok)throw Error('Authentication config unavailable');const c=await response.json();if(!c.supabaseUrl||!c.supabaseAnonKey){console.info('Backend configuration missing');return}if(!window.supabase){toast('Authentication library unavailable');return}sb=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey);remoteReady=true;const {data:{session}}=await sb.auth.getSession();await syncSession(session);sb.auth.onAuthStateChange((event,s)=>{if(event==='PASSWORD_RECOVERY'){state.authMode='change';setTimeout(renderAuth,0)}if(event==='TOKEN_REFRESHED'||(['SIGNED_IN','INITIAL_SESSION'].includes(event)&&state.user?.id&&s?.user?.id===state.user.id))return;setTimeout(()=>syncSession(s),0)});}catch(e){console.error('Backend initialization:',e)}finally{window.roBackendReady=true;const target=location.hash.slice(1);let hasGuideTarget=false;try{hasGuideTarget=Boolean(sessionStorage.getItem('ro_guide_target_20261025'));}catch{}if(!hasGuideTarget&&['studio','projects','downloads','profile','match'].includes(target))go(target);window.dispatchEvent(new Event('ro-backend-ready'));}}
async function syncSession(session){
 if(!remoteReady)return;
 if(!session){sessionGeneration++;sessionSync=null;sessionSyncUser=null;state.user=null;state.projects=[];window.roCloseMemberships?.();window.roRefreshCreatorKitVisibility?.();render();return}
 if(!session.user?.email_confirmed_at){await sb.auth.signOut();toast('Please verify your email address before using RhymeOrbit.');return}
 if(sessionSync&&sessionSyncUser===session.user.id)return sessionSync;
 const version=++sessionGeneration;
 sessionSyncUser=session.user.id;
 sessionSync=(async()=>{
   // A cached local session is not proof of authentication. Verify its token
   // with Supabase Auth server before populating the UI or loading account data.
   const verified=await sb.auth.getUser();
   const verifiedUser=verified?.data?.user;
   if(verified.error||!verifiedUser?.id||verifiedUser.id!==session.user.id||!verifiedUser.email_confirmed_at){
     if(version===sessionGeneration){state.user=null;state.projects=[];render();toast('Session could not be verified. Please sign in again.');}
     return;
   }
   if(version!==sessionGeneration)return;
   const [profileResult,projectsResult]=await Promise.all([
     sb.from('profiles').select('username,display_name,bio').eq('id',verifiedUser.id).maybeSingle(),
     sb.from('projects').select('id,title,lyrics,genre,mood,language,updated_at').order('updated_at',{ascending:false})
   ]);
   if(version!==sessionGeneration)return;
   const profile=profileResult.data;
   state.user={id:verifiedUser.id,name:profile?.display_name||verifiedUser.user_metadata?.display_name||'Creator',username:profile?.username||'',email:verifiedUser.email,bio:profile?.bio||'',firstName:verifiedUser.user_metadata?.first_name||'',lastName:verifiedUser.user_metadata?.last_name||'',homeState:verifiedUser.user_metadata?.home_state||'',gender:verifiedUser.user_metadata?.gender||'prefer_not_to_say'};
   if(projectsResult.error)console.error(projectsResult.error);
   state.projects=projectsResult.data||[];
   window.roRefreshCreatorKitVisibility?.();render();roWelcomeBack();
 })();
 try{return await sessionSync}finally{if(version===sessionGeneration){sessionSync=null;sessionSyncUser=null}}
}
let roWelcomedUser=null;
let roWelcomeSerial=0;
function roWelcomeBack(){
 const user=state.user;if(!user||roWelcomedUser===user.id)return;
 roWelcomedUser=user.id;
 const taglines=['Aaj ek naya gaana, ek nayi kahaani!','Let your next melody become magic!','Your creativity deserves the spotlight!','A beautiful song begins with one idea!','Keep singing, keep shining, keep creating!','Make something wonderful today!','Every great artist starts with a dream!','Your imagination is the sweetest kind of music!'];
 const previous=Number(sessionStorage.getItem('roWelcomeLastIndex')||'-1');
 let index=Math.floor(Math.random()*taglines.length);if(index===previous)index=(index+1)%taglines.length;
 sessionStorage.setItem('roWelcomeLastIndex',String(index));
 const gender=String(user.gender||'prefer_not_to_say').toLowerCase();
 const salutation=gender==='male'?'Hello handsome':gender==='female'?'Hello beautiful':'Hello creator';
 const greeting=salutation+'! Welcome to RhymeOrbit. '+taglines[index];
 toast(greeting);
 const serial=++roWelcomeSerial;
 try{if(window.roCreativeAudio?.speak){
   const say=()=>{if(serial!==roWelcomeSerial||roWelcomedUser!==user.id)return;
     window.roCreativeAudio.speak(greeting,{lang:'en-IN',rate:1.08,pitch:1.04});
   };
   // Voices may be reported asynchronously after page load. Still speak only once.
   if(window.speechSynthesis?.getVoices().length)say();else setTimeout(say,350);
 }else if('speechSynthesis' in window && 'SpeechSynthesisUtterance' in globalThis){
   // Graceful fallback for cached pages that have not loaded the voice helper yet.
   window.speechSynthesis.speak(new SpeechSynthesisUtterance(greeting));
 }}catch(e){console.warn('Voice welcome unavailable',e)}
}

openAuth=function(mode='signup'){if(!remoteReady)return toast('Login is not configured. Set up Supabase first.');state.authMode=mode;renderAuth()};
renderAuth=function(){const mode=state.authMode,login=mode==='login',signup=mode==='signup',forgot=mode==='forgot',change=mode==='change';$('overlay').innerHTML=`<div class="modal-layer" onclick="if(event.target===this)closeAuth()"><div class="modal" role="dialog" aria-modal="true"><button class="btn sm close" onclick="closeAuth()">✕</button><div class="eyebrow">RHYMEORBIT ACCOUNT</div><h2>${signup?'Join the orbit.':forgot?'Reset password.':change?'New password.':'Welcome back.'}</h2><p class="muted">${forgot?'We’ll email a secure reset link.':signup?'Create your account with a username, password and email. Verify your email address using the link we send before signing in.':change?'Choose a strong new password.':'Log in with your username and password.'}</p><form onsubmit="submitAuth(event)">${signup?`<div class="field"><label>First name</label><input id="authFirstName" required maxlength="40" autocomplete="given-name"></div><div class="field"><label>Last name</label><input id="authLastName" required maxlength="40" autocomplete="family-name"></div><div class="field"><label>State / Region</label><input id="authHomeState" required maxlength="80" autocomplete="address-level1" placeholder="e.g. Haryana"></div><div class="field"><label for="authGender">Gender (for personalized greeting)</label><select id="authGender" required><option value="" disabled selected>Select an option</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>`:''}${signup?`<div class="field"><label>Username (3–24 characters, letters/numbers/_)</label><input id="authUsername" required pattern="[a-zA-Z0-9_]{3,24}" autocomplete="username"></div>`:''}${signup||forgot?`<div class="field"><label>Email</label><input id="authEmail" type="email" required autocomplete="email"></div>`:''}${login?`<div class="field"><label>Username</label><input id="authUsername" required autocomplete="username"></div>`:''}${!forgot?`<div class="field"><label>${change?'New password':'Password'}</label><input id="authPassword" type="password" minlength="8" required autocomplete="${signup||change?'new-password':'current-password'}"></div>`:''}<button class="btn gold" type="submit" style="width:100%">${signup?'Create account':forgot?'Send reset link':change?'Update password':'Log in'} ↗</button></form><div class="row" style="margin-top:16px">${login?`<button class="navlink" onclick="state.authMode='forgot';renderAuth()">Forgot password?</button>`:''}<button class="navlink" onclick="state.authMode='${signup?'login':'signup'}';renderAuth()">${signup?'Already registered? Log in':'Create account'}</button></div><p class="muted small">Password reset links are emailed to the registered inbox. New accounts require email verification before sign-in.</p></div></div>`};
submitAuth=async function(e){e.preventDefault();if(!sb)return;const mode=state.authMode;const password=$('authPassword')?.value;const email=$('authEmail')?.value.trim().toLowerCase();const username=$('authUsername')?.value.trim().toLowerCase();const firstName=$('authFirstName')?.value.trim()||'';const lastName=$('authLastName')?.value.trim()||'';const homeState=$('authHomeState')?.value.trim()||'';const gender=$('authGender')?.value||'prefer_not_to_say';const name=(firstName+' '+lastName).trim();if(mode==='signup'&&!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email||'')){toast('Please enter a valid email address, like name@example.com.');return}try{let result;if(mode==='signup'){result=await sb.auth.signUp({email,password,options:{data:{username,display_name:name,first_name:firstName,last_name:lastName,home_state:homeState,gender},emailRedirectTo:'https://rhymeorbit.in/'}});if(result.error)throw result.error;closeAuth();if(result.data?.session){if(!result.data.user?.email_confirmed_at){await sb.auth.signOut();toast('Check your inbox and verify your email before logging in.');return}await syncSession(result.data.session);go('projects');toast('Your account is ready! Welcome to RhymeOrbit.')}else toast('Check your inbox (including spam) and click the RhymeOrbit verification link before logging in.');return}if(mode==='forgot'){result=await sb.auth.resetPasswordForEmail(email,{redirectTo:'https://rhymeorbit.in/reset-password.html'});if(result.error)throw result.error;closeAuth();toast('If this email is registered, a password-reset link will arrive.');return}if(mode==='change'){result=await sb.auth.updateUser({password});if(result.error)throw result.error;closeAuth();toast('Password updated');return}const r=await fetch('/api/username-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const data=await r.json();if(!r.ok)throw Error(data.error||'Login failed');result=await sb.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});if(result.error||!result.data?.session)throw(result.error||new Error('No verified session returned'));await syncSession(result.data.session);if(!state.user||state.user.id!==result.data.session.user.id)throw Error('Login could not be verified. Please try again.');closeAuth();toast('Welcome back ✦');go(state.pending||'projects');state.pending=null}catch(err){toast(err.message||'Authentication failed')}};
logout=async function(){if(!sb)return;const {error}=await sb.auth.signOut();if(error){toast('Sign out failed: '+error.message);return}roWelcomeSerial++;window.speechSynthesis?.cancel();roWelcomedUser=null;state.user=null;state.projects=[];state.editId=null;window.roCloseMemberships?.();window.roRefreshCreatorKitVisibility?.();go('home');toast('Signed out')};
saveProject=async function(){if(!requireUser('studio')||!sb)return;const title=$('songTitle').value.trim(),lyrics=$('songLyrics').value.trim();if(!title||!lyrics)return toast('Add title and lyrics');const payload={user_id:state.user.id,title,lyrics,genre:$('songGenre').value,mood:$('songMood').value,language:$('songLanguage').value,updated_at:new Date().toISOString()};if(state.editId)payload.id=state.editId;const {error}=await sb.from('projects').upsert(payload);if(error)return toast('Save failed: '+error.message);state.editId=null;await syncSession((await sb.auth.getSession()).data.session);go('projects');toast('Saved securely to your account')};
deleteProject=async function(id){if(!confirm('Delete this project permanently?'))return;const {error}=await sb.from('projects').delete().eq('id',id);if(error)return toast(error.message);await syncSession((await sb.auth.getSession()).data.session);toast('Project deleted')};
saveProfile=async function(){const n=$('profileName').value.trim(),bio=$('profileBio').value.trim();if(!n)return toast('Enter a display name');const {error}=await sb.from('profiles').update({display_name:n,bio}).eq('id',state.user.id);if(error)return toast(error.message);await syncSession((await sb.auth.getSession()).data.session);toast('Profile updated')};
window.roSaveGreetingPreference=async function(){
 if(!sb||!state.user)return toast('Log in to change your greeting');
 const gender=$('profileGreetingGender')?.value;
 if(!['male','female','non_binary','prefer_not_to_say'].includes(gender))return toast('Select a valid greeting option');
 try{
  const {error}=await sb.auth.updateUser({data:{gender}});
  if(error)throw error;
  state.user.gender=gender;
  toast('Greeting preference saved. It will apply on your next login.');
 }catch(e){toast('Could not save greeting preference: '+(e.message||'Please retry'))}
};
// Disable unsafe local-account deletion: backend account deletion requires a verified server endpoint.
deleteLocalAccount=function(){window.location.assign('/delete-account.html')};
// Play AI-generated-content and user-safety reporting: authenticated, RLS-protected, in-app.
window.roOpenSafetyReport=function(category='general', reference=''){
 const allowed=['ai','community','user','message','general'];
 const kind=allowed.includes(category)?category:'general';
 if(!sb||!state.user){toast('Sign in to submit a safety report.');openAuth('login');return}
 document.getElementById('roSafetyReportOverlay')?.remove();
 const layer=document.createElement('div');
 layer.id='roSafetyReportOverlay';
 layer.setAttribute('role','presentation');
 layer.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(8,9,16,.82);display:grid;place-items:center;padding:18px;overflow:auto';
 const dialog=document.createElement('section');
 dialog.setAttribute('role','dialog');
 dialog.setAttribute('aria-modal','true');
 dialog.setAttribute('aria-labelledby','roSafetyReportTitle');
 dialog.style.cssText='width:min(100%,500px);border:1px solid #d9d1f6;border-radius:22px;background:#fff;color:#26213d;padding:25px;max-height:90vh;overflow:auto;box-shadow:0 22px 70px #0008';
 dialog.innerHTML='<h2 id="roSafetyReportTitle" style="margin:0 0 12px;font-size:23px">Report a safety concern</h2>'
  +'<p style="font-size:14px;line-height:1.6">Help us review harmful, offensive or inappropriate content. Please do not paste illegal images, passwords or private identifiers.</p>'
  +'<form id="roSafetyReportForm">'
  +'<label for="roReportReference" style="display:block;margin-top:12px">Content link or reference (optional)</label>'
  +'<input id="roReportReference" maxlength="200" style="box-sizing:border-box;width:100%;padding:10px;color:#181326;background:#fff;border:1px solid #c1b4d9;border-radius:9px">'
  +'<label for="roReportReason" style="display:block;margin-top:12px">What happened?</label>'
  +'<textarea id="roReportReason" required minlength="10" maxlength="1500" rows="5" style="box-sizing:border-box;width:100%;padding:10px;color:#181326;background:#fff;border:1px solid #c1b4d9;border-radius:9px"></textarea>'
  +'<p id="roReportStatus" role="status" style="font-size:13px;min-height:20px"></p>'
  +'<div style="display:flex;gap:9px;flex-wrap:wrap">'
  +'<button id="roReportSend" type="submit" style="padding:10px 15px;border-radius:20px;border:0;background:#6349cc;color:white">Submit report</button>'
  +'<button id="roReportClose" type="button" style="padding:10px 15px;border-radius:20px;border:1px solid #b9b4ce;background:white;color:#26213d">Cancel</button>'
  +'</div></form><p style="font-size:12px">If submission fails, contact <a style="color:#5540ad" href="mailto:dtipun@gmail.com?subject=RhymeOrbit%20safety%20report">dtipun@gmail.com</a>.</p>';
 layer.append(dialog);document.body.append(layer);
 const ref=dialog.querySelector('#roReportReference');ref.value=String(reference||'').slice(0,200);
 dialog.querySelector('#roReportClose').onclick=()=>layer.remove();
 const reason=dialog.querySelector('#roReportReason');reason.focus();
 dialog.querySelector('#roSafetyReportForm').onsubmit=async function(event){
  event.preventDefault();
  const message=reason.value.trim(),status=dialog.querySelector('#roReportStatus'),submit=dialog.querySelector('#roReportSend');
  if(message.length<10){status.textContent='Please describe the problem (at least 10 characters).';return}
  submit.disabled=true;status.textContent='Sending your report…';
  try{
   const result=await sb.auth.getSession();
   const session=result.data?.session;
   if(result.error||!session?.user?.id)throw new Error('Sign in again and retry.');
   const saved=await sb.from('safety_reports').insert({reporter:session.user.id,category:kind,reference:ref.value.trim().slice(0,200),reason:message});
   if(saved.error)throw saved.error;
   status.textContent='Report submitted. Thank you for helping keep RhymeOrbit safe.';
   submit.remove();setTimeout(()=>layer.remove(),4000);
  }catch(e){status.textContent='Could not submit: '+(e?.message||'Please retry or email support.');submit.disabled=false}
 };
};

// Replace local demo analysis with real Gemini generation when configured.
async function runAI(kind,input,target){if(!sb||!state.user)return toast('Log in to use AI');const el=$(target);if(el)el.innerHTML='<div class="note loading">Generating with AI…</div>';try{const aiText=await roGenerateAIText(kind,input);if(el)el.innerHTML=`<div class="note" style="white-space:pre-wrap">${esc(aiText)}</div>`}catch(e){if(el)el.innerHTML=`<div class="note">${esc(e.message)}</div>`}}
songDoctor=function(){const lyrics=$('songLyrics').value.trim();if(!lyrics)return toast('Write some lyrics first');runAI('doctor',lyrics,'doctorResult')};
vibeBrief=function(){const brief=$('vibeInput').value.trim();if(!brief)return toast('Describe a vibe');runAI('vibe',brief,'vibeResult')};
askHelp=function(){const q=$('helpInput').value.trim();if(!q)return toast('Enter your question');if(!state.user)return $('helpAnswer').innerHTML='<div class="note">Sign in to use the AI assistant.</div>';runAI('help',q,'helpAnswer')};
// One canonical lyrics editor and songwriting action is maintained in public/index.html.
const baseProfile=profile;
profile=function(){let p=baseProfile();if(state.user)p=p.replace('<button class="btn" onclick="logout()">Sign out</button>','<button class="btn" onclick="logout()">Sign out</button><button class="btn" onclick="state.authMode=\'change\';renderAuth()">Change password</button>');return p};
initBackend();

// Social actions require backend tables before production.
like=function(){toast('Likes need a connected social database; coming next.')};
follow=function(){toast('Following needs a connected social database; coming next.')};
