import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=p=>readFileSync(resolve(root,p),'utf8');
const interactive=['index','ai-lyrics-generator','ai-song-generator','shayari-generator','sing-your-song','vocal-lab','video-maker'];

test('Public deletion request and in-app profile path',()=>{
 const page=file('public/delete-account.html'),home=file('public/index.html'),privacy=file('public/privacy.html');
 assert.match(page,/<form id="deleteForm">/);
 assert.match(page,/mailto:dtipun@gmail.com/);
 assert.match(page,/request deletion of your account/i);
 assert.match(home,/Delete account and data/);
 assert.match(home,/delete-account.html/);
 assert.match(privacy,/delete-account.html/);
});

test('Interactive entry pages check age band and Kids Studio stays local',()=>{
 for(const name of interactive){
  const page=file('public/'+name+'.html');
  assert.match(page,/id="ro-age-guard"/,name);
  assert.match(page,/ro_age_band_v1/,name);
 }
 const age=file('public/age-check.html'),kids=file('public/kids.html');
 assert.match(age,/Under 13/);
 assert.match(age,/13–17/);
 assert.match(age,/18 or older/);
 assert.match(kids,/on-device|on this device/i);
 assert.match(kids,/no online child account/i);
 assert.doesNotMatch(kids,/<script[^>]+src=/i,'No external scripts on kids page');
 assert.doesNotMatch(kids,/\bfetch\s*\(/i,'No network requests from Kids Studio');
 assert.doesNotMatch(kids,/<input[^>]+type="email"/i,'No child email collection');
});

test('Private safety reporting data access and in-app controls',()=>{
 const js=file('public/integration.js'),schema=file('supabase/migrations/20261029_play_policy_safety_reports.sql'),home=file('public/index.html');
 assert.match(schema,/enable row level security/i);
 assert.match(schema,/with check \(\(select auth.uid\(\)\) = reporter\)/i);
 assert.match(schema,/revoke all on public.safety_reports from anon, authenticated/i);
 assert.match(js,/roOpenSafetyReport/);
 assert.match(js,/\.from\('safety_reports'\)\.insert/);
 assert.match(home,/Report AI answer/);
 assert.match(home,/Report a safety problem in app/);
});

test('Sensitive scripts are syntactically valid',()=>{
 for(const path of ['public/integration.js']){
  assert.doesNotThrow(()=>new Function(file(path)),path);
 }
 for(const name of ['age-check','kids','delete-account','index']){
  const page=file('public/'+name+'.html');
  const scripts=[...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/src=|application\/ld\+json/i.test(m[1])).map(m=>m[2]);
  for(const script of scripts)assert.doesNotThrow(()=>new Function(script),name);
 }
});
