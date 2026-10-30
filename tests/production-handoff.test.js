import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(base,p),'utf8');

test('Developer handoff identifies canonical Cloudflare production and module map',()=>{
 const root=read('README.md'),map=read('docs/RHYMEORBIT_SOURCE_OF_TRUTH.md');
 assert.match(root,/Cloudflare Worker/);
 assert.match(root,/tipun/);
 assert.match(root,/master/);
 assert.match(root,/rhymeorbit\.in/);
 assert.match(root,/Google Play/);
 assert.match(root,/PLAY_APP_SIGNING_SHA256/);
 assert.match(root,/checkout remains \*\*OFF\*\*/i);
 for(const path of ['cloudflare/worker.js','public/integration.js','public/memberships.js'])assert.ok(map.includes(path));
});
test('Manual admin grant limits align with server and database entitlements',()=>{
 const app=read('public/index.html'),api=read('api/index.js');
 const sql=read('supabase/migrations/20261031_admin_pro_quota_alignment.sql');
 assert.match(app,/<option value="pro">Pro/);
 assert.match(app,/premium: 35, pro: 75/);
 assert.match(api,/pro:75/);
 assert.match(api,/plan === 'premium'.*limit > 35/);
 assert.match(api,/plan === 'pro'.*limit > 75/);
 assert.match(sql,/p_plan NOT IN \('free', 'premium', 'pro'\)/);
 assert.match(sql,/p_plan = 'pro'.*p_monthly_limit > 75/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(api,/s\?\.plan === 'pro' \? 75/);
});
test('Static pricing cannot collect payment before server verification is implemented',()=>{
 const worker=read('cloudflare/worker.js'),web=read('public/play-billing.js');
 assert.match(worker,/checkoutEnabled:false/);
 assert.match(worker,/status:503/);
 assert.match(web,/readyForCheckout:\(\)=>false/);
 assert.doesNotMatch(web,/new PaymentRequest\(/);
});
