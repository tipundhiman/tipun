import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.resolve(import.meta.dirname, '../public');
const source = name => fs.readFileSync(path.join(publicDir, name), 'utf8');
const pages = fs.readdirSync(publicDir).filter(name => name.endsWith('.html'));

test('the full site uses a light-first shared theme without remote icon runtime', () => {
  for (const page of pages) {
    const html = source(page);
    assert.match(html, /name="viewport"/, page);
    if (page === 'offline.html') {
      assert.match(html, /:root\{color-scheme:light\}/);
      continue;
    }
    assert.match(html, /\/ro-design\.js\?v=/, `${page}: theme script`);
    assert.match(html, /\/ro-design\.css\?v=/, `${page}: theme styles`);
  }
  assert.doesNotMatch(source('mobile-app.js'), /lucide@.*cdn/);
});

test('theme persistence is opt-in dark with light as default', () => {
  const js = source('ro-design.js');
  const css = source('ro-design.css');
  assert.match(js, /localStorage\.getItem\(KEY\) === 'dark' \? 'dark' : 'light'/);
  assert.match(js, /localStorage\.setItem\(KEY, current\)/);
  assert.match(js, /data-ro-theme-toggle/);
  assert.match(css, /:root\[data-theme='light'\]/);
  assert.match(css, /:root\[data-theme='dark'\]/);
  assert.match(css, /color-scheme: light/);
  assert.match(css, /font-size: 15px/);
});

test('interactive navigation replaces emoji UI icons with local SVGs', () => {
  assert.match(source('ro-design.js'), /class=\\"ro-lucide-icon\\"|class="ro-lucide-icon"/);
  assert.match(source('mobile-app.js'), /window\.roDesign\?\.icon/);
  assert.match(source('mobile-app.js'), /data-ro-theme-toggle/);
  assert.match(source('site-nav.js'), /window\.roDesign\?\.icon\(item\.icon, 17\)/);
  assert.match(source('licenses.html'), /Lucide icons/);
});
