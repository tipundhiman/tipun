import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
test('Signup requires email verification for unconfirmed accounts',()=>{
 const auth=read('public/integration.js');
 assert.match(auth,/auth\.signUp\(/);
 assert.match(auth,/if\(result\.data\?\.session\)/);
 assert.match(auth,/await syncSession\(result\.data\.session\)/);
 assert.match(auth,/Please verify your email address before using RhymeOrbit/);
 assert.match(auth,/click the RhymeOrbit verification link before logging in/);
 assert.match(auth,/email_confirmed_at===null/);
 assert.match(read('api/index.js'),/Please verify your email address before signing in/);
 assert.match(read('cloudflare/media-storage.js'),/user\.email_confirmed_at !== null/);
 assert.match(auth,/Username/);
 assert.match(auth,/Forgot password\?/);
});
test('Forgot password retains email reset link and routes to a dedicated recovery page',()=>{
 const auth=read('public/integration.js');
 assert.match(auth,/resetPasswordForEmail\(email,\{redirectTo:location\.origin\+'\/reset-password\.html'\}\)/);
 const page=read('public/reset-password.html');
 const script=read('public/reset-password.js');
 assert.match(page,/noindex,nofollow/);
 assert.match(page,/id="resetForm" hidden/);
 assert.match(page,/autocomplete="new-password"/);
 assert.match(script,/recoveryAuthorized/);
 assert.match(script,/PASSWORD_RECOVERY/);
 assert.match(script,/auth\.updateUser\(\{password\}\)/);
 assert.match(script,/auth\.signOut\(\)/);
 assert.doesNotMatch(script,/console\.log\(.*password/);
 assert.doesNotThrow(()=>new Script(script,{filename:'reset-password.js'}));
});
test('User must affirm copyright permission before public generation',()=>{
 const html=read('public/index.html');
 const api=read('api/index.js');
 assert.match(html,/id="roSongRightsConfirmed"/);
 assert.match(html,/rightsConfirmed:true/);
 assert.match(html,/Content & Copyright/);
 assert.match(html,/href=\\?"\/copyright\\?"/);
 assert.match(api,/data\.rightsConfirmed!==true/);
});
