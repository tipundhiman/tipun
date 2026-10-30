import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('TWA next version uses Billing Library 8 bridge and new version code',()=>{
 const manifest=JSON.parse(read('android/twa-manifest.json'));
 const gradle=read('android/app/build.gradle');
 const android=read('android/app/src/main/AndroidManifest.xml');
 const delegated=read('android/app/src/main/java/in/rhymeorbit/app/DelegationService.java');
 assert.equal(manifest.packageId,'in.rhymeorbit.app');
 assert.equal(manifest.appVersionCode,2);
 assert.equal(manifest.features.playBilling.enabled,true);
 assert.match(gradle,/versionCode 2/);
 assert.match(gradle,/com\.google\.androidbrowserhelper:billing:1\.2\.0/);
 assert.match(android,/com\.android\.vending\.BILLING/);
 assert.match(android,/org\.chromium\.intent\.action\.PAY/);
 assert.match(android,/org\.chromium\.intent\.action\.IS_READY_TO_PAY/);
 assert.match(android,/android:enabled="true"\s+android:exported="true"/);
 assert.match(delegated,/DigitalGoodsRequestHandler\(getApplicationContext\(\)\)/);
 assert.doesNotMatch(android,/<uses-permission[^>]*android\.permission\.(?:ACCESS_FINE_LOCATION|READ_CONTACTS|MANAGE_EXTERNAL_STORAGE|READ_CALL_LOG)/);
});

test('Payment APIs remain fail-closed until checkout authorization is implemented',()=>{
 const worker=read('cloudflare/worker.js');
 const web=read('public/play-billing.js');
 const membership=read('public/memberships.js');
 assert.match(worker,/path === '\/api\/play-billing\/status'/);
 assert.match(worker,/checkoutEnabled:false/);
 assert.match(worker,/path\.startsWith\('\/api\/play-billing\/'\)/);
 assert.match(worker,/status:503/);
 assert.match(web,/getDigitalGoodsService/);
 assert.match(web,/readyForCheckout:\(\)=>false/);
 assert.doesNotMatch(web,/new PaymentRequest\(/);
 assert.match(membership,/No payment will be collected before verified checkout/);
 assert.match(membership,/data-select-plan/);
 assert.doesNotThrow(()=>new Function(web));
});

test('Local Kids Studio blocks networking and sensitive permissions',()=>{
 const headers=read('public/_headers');
 assert.match(headers,/\/kids\.html[\s\S]*?connect-src 'none'/);
 assert.match(headers,/\/kids\.html[\s\S]*?camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\)/);
 assert.match(read('public/kids.html'),/family-guard\.js/);
 assert.match(read('public/age-check.html'),/window\.roFamilyGuard\.verify/);
});
