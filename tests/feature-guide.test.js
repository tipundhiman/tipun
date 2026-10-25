import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Guide has sixteen unique findable destinations and a four-step tour', () => {
  const source = read('public/feature-guide.js');
  const linkBlock = source.split('const links = [')[1]?.split('];')[0];
  assert.ok(linkBlock);
  const entries = [...linkBlock.matchAll(/^    \['[^']+', '([^']+)'/gm)].map(match => match[1]);
  assert.equal(entries.length, 16);
  assert.equal(new Set(entries).size, entries.length);
  for (const section of ['Create', 'Video', 'Audio', 'Library', 'Explore', 'Account'])
    assert.ok(source.includes("'" + section + "'"));
  assert.equal((source.match(/\{name:'\d \/ /g) || []).length, 4);
  assert.match(source, /navigateToFeature/);
  assert.match(source, /ro_guide_target_20261025/);
  assert.match(source, /ro-backend-ready/);
  assert.match(source, /const essentials = new Set\(\[0,1,2,4,7,8\]\)/);
  assert.match(source, /See all 16 creator tools/);
  assert.match(source, /showAll \|\| q \|\| essentials\.has\(index\)/);
});

test('Guide loads on major public tools and main app with a single shared script', () => {
  for (const file of [
    'public/index.html', 'public/features.html', 'public/ai-song-generator.html',
    'public/ai-lyrics-generator.html', 'public/shayari-generator.html',
    'public/video-maker.html', 'public/vocal-lab.html'
  ]) assert.match(read(file), /src="\/feature-guide\.js\?v=20261025-[a-z0-9-]+"/);
  assert.match(read('public/integration.js'), /roBackendReady=true/);
});

test('Membership comparison names eighteen features without activating unverified paid promises', () => {
  const source = read('public/memberships.js');
  const matrix = source.split('const featureMatrix=[')[1]?.split('];')[0];
  assert.ok(matrix);
  assert.equal((matrix.match(/^ \['/gm) || []).length, 18);
  assert.match(source, /Compare all 18 creator features/);
  assert.match(source, /Higher quotas and quality downloads activate only with verified server-side memberships/);
  assert.match(source, /Checkout unavailable/);
});
