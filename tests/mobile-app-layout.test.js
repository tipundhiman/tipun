import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../public/mobile-app.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../public/mobile-app.css', import.meta.url), 'utf8');
const standalone = fs.readFileSync(new URL('../public/site-nav.js', import.meta.url), 'utf8');

test('the same app navigation is installed on the homepage and standalone tools', () => {
  assert.match(index, /mobile-app\.css\?v=/);
  assert.match(index, /mobile-app\.js\?v=/);
  assert.match(standalone, /mobile-app\.css\?v=/);
  assert.match(standalone, /mobile-app\.js\?v=/);
  assert.match(index, /window\.roMobileApp\?\.refresh\(state\.page\)/);
});

test('mobile tabs have real destinations and do not interrupt playback on More', () => {
  for (const href of ['/#listen', '/sing-your-song', '/#studio', '/video-maker', '/vocal-lab', '/install']) {
    assert.ok(shell.includes(`href: '${href}'`), `Missing route: ${href}`);
  }
  assert.match(shell, /document\.body\.append\(bar, sheet\)/);
  assert.match(shell, /moreButton\.addEventListener\('click', open\)/);
  assert.match(shell, /window\.go\(destination\)/);
  assert.doesNotMatch(shell, /window\.location\.reload\(/);
});

test('mobile sheet has accessible dialog, keyboard escape, and focus management', () => {
  assert.match(shell, /setAttribute\('aria-label', 'Mobile app navigation'\)/);
  assert.match(shell, /role="dialog" aria-modal="true"/);
  assert.match(shell, /event\.key === 'Escape'/);
  assert.match(shell, /event\.key === 'Tab'/);
  assert.match(shell, /aria-current/);
  assert.match(styles, /\.ro-mobile-feature-sheet\[hidden\]/);
  assert.match(styles, /env\(safe-area-inset-bottom/);
});

test('phone layout keeps primary controls visible and chat clear of navigation', () => {
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /#roCcScene \{ min-height: 320px/);
  assert.match(styles, /\.ro-yt-search-form \{ flex-direction: column/);
  assert.match(styles, /#roOrbitHelpButton \{ right: 13px; bottom:/);
});
