/* Admin-only Treblo recovery UI. API authorization is enforced on server. */
(function(){
'use strict';
let verifiedUser=null;
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
   if(result.isAdmin===true){box.hidden=false;verifiedUser=session.user?.id||null}
 }catch{}
}
const observer=new MutationObserver(()=>{const box=document.getElementById('roAdminTrebloTools');if(box&&box.dataset.checked!=='yes'){box.dataset.checked='yes';check()}});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target?.closest?.('[onclick*="go("]'))setTimeout(check,300)});
setInterval(()=>{const box=document.getElementById('roAdminTrebloTools');if(box)check()},30000);
check();
})();