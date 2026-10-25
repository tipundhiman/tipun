import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = file => readFileSync(new URL('../public/' + file, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));

test('PWA is installable from the same production origin', () => {
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name.includes('RhymeOrbit'));
  assert.match(read('index.html'), /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(read('index.html'), /pwa-register\.js\?v=/);
  assert.match(read('index.html'), /href=\\"\/install\\"/);
});

test('Home Screen icons are PNG images with declared exact sizes', () => {
  for (const icon of manifest.icons) {
    const filename = icon.src.substring(1);
    assert.ok(existsSync(new URL('../public/' + filename, import.meta.url)), `Missing ${filename}`);
    const buffer = readFileSync(new URL('../public/' + filename, import.meta.url));
    assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG');
    const requested = Number(icon.sizes.split('x')[0]);
    assert.equal(buffer.readUInt32BE(16), requested);
    assert.equal(buffer.readUInt32BE(20), requested);
  }
});

test('Offline worker does not cache user data, music, login or API responses', () => {
  const worker = read('service-worker.js');
  assert.match(worker, /request\.mode !== 'navigate'/);
  assert.match(worker, /pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /cache\.addAll\(\[OFFLINE, ICON\]\)/);
  assert.doesNotMatch(worker, /cache\.put\(request|cache\.addAll\(\['\/api/);
  assert.match(read('offline.html'), /We don't store your private music or account data offline/);
});

test('Install guide supports Android, iPhone and desktop without promising native app stores', () => {
  const page = read('install.html');
  for (const label of ['Android · Chrome', 'iPhone · Safari', 'Desktop browser'])
    assert.ok(page.includes(label), label);
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /appinstalled/);
  assert.match(page, /not yet a Play Store or App Store release/);
  assert.match(read('site-nav.js'), /href: '\/install'/);
});
