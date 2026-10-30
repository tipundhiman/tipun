import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=p=>readFileSync(resolve(root,p),'utf8');

test('Age declaration required for new and existing online accounts',()=>{
 const js=source('public/integration.js');
 assert.match(js,/id="authBirthDate"/);
 assert.match(js,/birth_date:birthDate/);
 assert.match(js,/roReportedAge\(birthDate\)/);
 assert.match(js,/await roSyncAccountAge\(verifiedUser\.id\)/);
 assert.match(js,/ro_account_ages/);
 assert.match(js,/sb\.auth\.signOut\(\)/);
 assert.match(js,/location\.assign\('\/kids\.html'\)/);
 assert.doesNotThrow(()=>new Function(js));
});
test('Birth date data is private, immutable from client and social posting requires adult check',()=>{
 const sql=source('supabase/migrations/20261031_account_age_guard.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.ro_account_ages/i);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
 assert.match(sql,/GRANT SELECT, INSERT ON public\.ro_account_ages TO authenticated/i);
 assert.doesNotMatch(sql,/GRANT (?:UPDATE|DELETE|ALL) ON public\.ro_account_ages TO authenticated/i);
 assert.match(sql,/ro_record_signup_birth_date/i);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.ro_is_adult/i);
 assert.match(sql,/creator_swipes/i);
 assert.match(sql,/creator_messages/i);
 assert.match(sql,/creator_media/i);
 assert.match(sql,/community_posts/i);
});
test('Real money stays blocked until verified Play merchant and paid-credits flow is proven',()=>{
 const worker=source('cloudflare/worker.js'),pay=source('public/play-billing.js');
 assert.match(worker,/checkoutEnabled:false/);
 assert.match(worker,/status:503/);
 assert.match(pay,/readyForCheckout:\(\)=>false/);
});
