/* Secure password reset only. Never log recovery tokens or credentials. */
(async()=>{
 const status=document.getElementById('status');
 const form=document.getElementById('resetForm');
 const button=document.getElementById('savePassword');
 const wasRecoveryLink=/(\btype=recovery\b|\bcode=)/i.test(location.search+' '+location.hash);
 let recoveryAuthorized=wasRecoveryLink;
 const show=(msg)=>{status.textContent=msg};
 try{
  if(!window.supabase)throw Error('Secure sign-in library is unavailable. Please reload.');
  const response=await fetch('/api/config',{cache:'no-store'});
  if(!response.ok)throw Error('Could not connect to account recovery.');
  const data=await response.json();
  if(!data.supabaseUrl||!data.supabaseAnonKey)throw Error('Account recovery is currently unavailable.');
  const client=window.supabase.createClient(data.supabaseUrl,data.supabaseAnonKey);
  client.auth.onAuthStateChange((event)=>{
   if(event==='PASSWORD_RECOVERY'){recoveryAuthorized=true;form.hidden=false;show('Link verified. Enter your new password.')}
  });
  const session=(await client.auth.getSession()).data?.session;
  if(!session?.access_token||!recoveryAuthorized){
   show('This reset link has expired or is invalid. Please request a new one from the login screen.');
   return;
  }
  form.hidden=false;
  show('Secure reset link verified. Choose a new password.');
  history.replaceState(null,'','/reset-password.html');
  form.addEventListener('submit',async(event)=>{
   event.preventDefault();
   const password=document.getElementById('newPassword').value;
   const confirm=document.getElementById('repeatPassword').value;
   if(password.length<8){show('Use a password with at least 8 characters.');return}
   if(password!==confirm){show('Passwords do not match.');return}
   button.disabled=true;show('Updating password…');
   try{
    const result=await client.auth.updateUser({password});
    if(result.error)throw result.error;
    await client.auth.signOut();
    form.hidden=true;
    show('Password updated successfully. Return to RhymeOrbit and log in with your username and new password.');
   }catch(error){show(error.message||'Password update failed. Try requesting a fresh reset link.')}
   finally{button.disabled=false}
  });
 }catch(error){form.hidden=true;show(error.message||'Unable to verify your reset link. Please try again.')}
})();
