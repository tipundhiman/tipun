import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
test('Only AI Studio owns the public song-generation request',()=>{
 const media=read('public/media.js'),main=read('public/index.html');
 assert.doesNotMatch(media,/async function createMusic\(|async function checkMusic\(|musicJob\s*=|musicTimer\s*=/);
 assert.doesNotMatch(media,/\/api\/music\/generate/);
 assert.match(main,/window\.roStartMurekaTest=async function/);
 assert.match(main,/rightsConfirmed:true/);
 assert.match(main,/\/api\/music\/generate/);
});
test('Paid checkout is disabled until entitlement and provider limits match prices',()=>{
 const memberships=read('public/memberships.js'),api=read('api/index.js');
 assert.match(memberships,/Paid checkout is not active yet/);
 assert.match(memberships,/No payment will be collected before verified checkout/);
 assert.match(api,/const limit = !active \? 0 : !s \|\| s\.plan === 'free' \? 3 : paidLimit;/);
 assert.match(api,/const paidCap = s\?\.plan === 'pro' \? 75 : s\?\.plan === 'premium' \? 35 : 0;/);
 const sql=read('supabase/commercial_entitlements.sql');
 assert.match(sql,/WHEN 'premium' THEN LEAST\(35/);
 assert.match(sql,/WHEN 'pro' THEN LEAST\(75/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.ro_reserve_song/);
 assert.doesNotMatch(api,/\/api\/billing\/create-subscription/);
});
