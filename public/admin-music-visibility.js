/* Admin-only Treblo recovery UI. API authorization is enforced on server. */
(function(){
'use strict';
let verifiedUser=null;
let migrating=false;
async function token(){
 const client=(typeof sb!=='undefined'&&sb?.auth)?sb:window.sb;
 return (await client?.auth?.getSession())?.data?.session?.access_token||null;
}
function migrationStatus(value){const node=document.getElementById('roStorageMigrationStatus');if(node)node.textContent=value}
async function storageRequest(method){
 const accessToken=await token();if(!accessToken)throw Error('Please sign in again');
 const response=await fetch('/api/admin/storage-migration',{method,headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Storage migration unavailable');
 return result;
}
function showStorageTools(box){
 if(box.dataset.storageTools)return;
 box.dataset.storageTools='yes';
 const divider=document.createElement('div');divider.style.cssText='border-top:1px solid #ffffff33;margin-top:20px;padding-top:16px';
 const heading=document.createElement('h4');heading.textContent='☁ Cloudflare R2 storage migration';
 const info=document.createElement('p');info.className='muted small';info.textContent='Move older Supabase media and song audio to R2. Original files stay available as backup.';
 const status=document.createElement('p');status.id='roStorageMigrationStatus';status.className='muted small';status.setAttribute('role','status');status.textContent='Checking legacy file count…';
 const action=document.createElement('button');action.id='roRunStorageMigration';action.className='btn sm';action.type='button';action.textContent='↻ Move verified copies to Cloudflare';action.onclick=window.roMigrateStorage;
 divider.append(heading,info,status,action);box.append(divider);
 storageRequest('GET').then(data=>migrationStatus(`${data.remaining.media} media + ${data.remaining.songs} songs pending`)).catch(()=>migrationStatus('Storage count unavailable — retry after signing in.'));
}
window.roMigrateStorage=async function(){
 if(migrating||!verifiedUser)return;
 const button=document.getElementById('roRunStorageMigration');migrating=true;if(button)button.disabled=true;
 try{
  let progress=0;
  for(let i=0;i<100;i++){
   const result=await storageRequest('POST');
   if(result.migrated){progress++;migrationStatus(`Verified ${progress} file(s) in R2. Remaining: ${result.remaining.media} media, ${result.remaining.songs} songs.`)}
   if(result.complete||(!result.remaining.media&&!result.remaining.songs)){
    migrationStatus(`Migration complete: ${progress} file(s) verified. Original Supabase objects preserved.`);break;
   }
  }
 }catch(error){migrationStatus('Paused safely: '+error.message+'. Original Supabase files remain untouched.')}
 finally{migrating=false;if(button)button.disabled=false}
};
async function check(){
 const box=document.getElementById('roAdminTrebloTools');
 if(!box)return;
 box.hidden=true;
 try{
   const client=(typeof sb!=='undefined'&&sb?.auth)?sb:window.sb;
   if(!client?.auth)return;
   const session=(await client.auth.getSession()).data?.session;
   if(!session?.access_token)return;
   const response=await fetch('/api/admin/overview',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
   if(!response.ok)return;
   const result=await response.json();
   if(result.isAdmin===true){box.hidden=false;verifiedUser=session.user?.id||null;showStorageTools(box)}
 }catch{}
}
const observer=new MutationObserver(()=>{const box=document.getElementById('roAdminTrebloTools');if(box&&box.dataset.checked!=='yes'){box.dataset.checked='yes';check()}});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target?.closest?.('[onclick*="go("]'))setTimeout(check,300)});
setInterval(()=>{const box=document.getElementById('roAdminTrebloTools');if(box)check()},30000);
check();
})();
