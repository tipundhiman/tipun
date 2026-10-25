import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const read = name => readFileSync(join(process.cwd(), 'public', name), 'utf8');
const script = read('site-nav.js');

test('Tool pages expose the same Back and cross-feature navigation', () => {
  for (const page of [
    'sing-your-song', 'video-maker', 'vocal-lab', 'ai-song-generator',
    'ai-lyrics-generator', 'shayari-generator', 'features'
  ]) {
    assert.match(read(page + '.html'), /<script src="\/site-nav\.js\?v=20261025-1" defer><\/script>/,
      `${page} is missing cross-feature navigation`);
  }
  for (const destination of ['/#listen', '/sing-your-song', '/video-maker',
    '/vocal-lab', '/#studio', '/#community']) {
    assert.ok(script.includes(destination), `Missing link: ${destination}`);
  }
  assert.match(read('site-nav.css'), /overflow-x:\s*auto/);
});

test('Back returns to an existing same-origin page and falls back to Home for external visits', () => {
  function element(tag) {
    return {
      tag, children: [], attributes: {}, listeners: {}, className: '', href: '',
      classList: { add() {} },
      setAttribute(key, value) { this.attributes[key] = value; },
      appendChild(child) { this.children.push(child); },
      append(...children) { this.children.push(...children); },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      querySelector() { return null; },
      insertAdjacentElement(_where, child) { this.inserted = child; }
    };
  }

  const header = element('header');
  const stylesheetContainer = element('head');
  const document = {
    readyState: 'complete', referrer: 'https://rhymeorbit.in/#listen',
    head: stylesheetContainer,
    querySelector(selector) { return selector === 'body > header' ? header : null; },
    createElement: element
  };
  let backCalls = 0;
  const window = {
    location: { origin: 'https://rhymeorbit.in', href: 'https://rhymeorbit.in/sing-your-song', pathname: '/sing-your-song' },
    history: { length: 2, back() { backCalls++; } }
  };
  runInContext(script, createContext({ document, window, URL }));

  const bar = header.inserted;
  assert.equal(bar.tag, 'nav');
  assert.equal(bar.attributes['aria-label'], 'Quick navigation between RhymeOrbit features');
  const [back, links] = bar.children;
  assert.equal(back.href, '/');
  assert.equal(links.children.some(link => link.href === '/#listen'), true);
  assert.equal(links.children.find(link => link.href === '/sing-your-song').attributes['aria-current'], 'page');
  let cancelled = 0;
  back.listeners.click({ preventDefault() { cancelled++; } });
  assert.equal(cancelled, 1);
  assert.equal(backCalls, 1);
  document.referrer = 'https://other.example/';
  back.listeners.click({ preventDefault() { cancelled++; } });
  assert.equal(cancelled, 1);
  assert.equal(backCalls, 1);
});

test('Direct AI Studio and downloads links load the requested page', () => {
  assert.match(read('index.html'), /'projects','downloads','listen'/);
  assert.match(read('index.html'), /state\.page=initial;render\(\)/);
});
