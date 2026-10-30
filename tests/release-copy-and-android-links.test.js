import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {APP_PACKAGE,assetLinksForFingerprint,serveAppAssetLinks} from '../cloudflare/asset-links.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.resolve(root,p),'utf8');
const appSigningHash=Array.from({length:32},(_,i)=>i.toString(16).padStart(2,'0')).join(':').toUpperCase();

test('Homepage and install copy no longer mislabel this release as Free Public Beta',()=>{
 const home=read('public/index.html');
 const install=read('public/install.html');
 assert.doesNotMatch(home,/FREE PUBLIC BETA|MEMBERSHIPS COMING SOON/i);
 assert.doesNotMatch(install,/Free public beta|not yet a Play Store or App Store release/i);
 assert.match(home,/CREATE ORIGINAL MUSIC/);
 assert.match(install,/Android app is available to invited Google Play testers/);
});
test('Android app association uses the Play app-signing fingerprint (not a hardcoded upload key)',()=>{
 const data=assetLinksForFingerprint(appSigningHash.toLowerCase());
 assert.equal(data.length,1);
 assert.deepEqual(data[0].relation,['delegate_permission/common.handle_all_urls']);
 assert.equal(data[0].target.package_name,APP_PACKAGE);
 assert.deepEqual(data[0].target.sha256_cert_fingerprints,[appSigningHash]);
 assert.equal(assetLinksForFingerprint(''),null);
 assert.equal(assetLinksForFingerprint('invalid'),null);
 assert.equal(assetLinksForFingerprint('AA:BB:CC'),null);
 assert.match(read('wrangler.jsonc'),/\.well-known\/assetlinks\.json/);
 assert.match(read('cloudflare/worker.js'),/serveAppAssetLinks/);
});
test('A valid app-signing hash produces cacheable public Digital Asset Links JSON',async()=>{
 const response=await serveAppAssetLinks(new Request('https://rhymeorbit.in/.well-known/assetlinks.json'),{
  PLAY_APP_SIGNING_SHA256:appSigningHash,ASSETS:{fetch(){throw Error('Should use verified DAL response')}}
 });
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/application\/json/);
 const [entry]=await response.json();
 assert.equal(entry.target.package_name,'in.rhymeorbit.app');
 assert.equal(entry.target.sha256_cert_fingerprints[0],appSigningHash);
});
test('Before a correct App Signing SHA-256 is set, preserve Cloudflare asset fallback rather than fake verification',async()=>{
 let fallback=false;
 const response=await serveAppAssetLinks(new Request('https://rhymeorbit.in/.well-known/assetlinks.json'),{
  ASSETS:{async fetch(){fallback=true;return new Response('Missing', {status:404})}}
 });
 assert.equal(response.status,404);
 assert.equal(fallback,true);
});
