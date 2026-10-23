import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root, file), 'utf8');
const html = read('public/index.html');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const scriptParts = scripts.map((match, index) => {
  const src = match[1].match(/\bsrc=["']([^"']+)["']/i)?.[1] || null;
  return { index, src, inline: match[2], structured: /type=["']application\/ld\+json["']/i.test(match[1]), local: src?.startsWith('/') ? src.split('?')[0] : null };
});

function allJS(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? allJS(path) : entry.name.endsWith('.js') ? [path] : [];
  });
}

test('Every JavaScript file passes the Node syntax check', () => {
  for (const file of ['server.js', ...allJS('api'), ...allJS('public')]) {
    const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, file + ': ' + result.stderr);
  }
});

test('Inline and local frontend scripts parse in actual HTML load order', () => {
  let combined = '';
  for (const part of scriptParts) {
    const source = part.structured ? '' : part.local ? read('public' + part.local) : part.src ? '' : part.inline;
    if (!source.trim()) continue;
    assert.doesNotThrow(() => new Script(source, { filename: part.local || 'inline-' + part.index }), 'Invalid script ' + (part.local || part.index));
    combined += '\n' + source;
  }
  assert.doesNotThrow(() => new Script(combined, { filename: 'page-bundle.js' }), 'Cross-script redeclaration or syntax error');
});

test('No missing or duplicate local JavaScript references', () => {
  const loaded = scriptParts.filter(x => x.local).map(x => x.local);
  for (const file of loaded) assert.ok(existsSync(join(root, 'public' + file)), 'Missing ' + file);
  assert.equal(new Set(loaded).size, loaded.length, 'Duplicate script src');
  assert.ok(loaded.includes('/integration.js'), 'Missing auth integration');
  assert.ok(loaded.includes('/memberships.js'), 'Missing membership dialog');
});

test('Login greeting does not speak or display any personal name', () => {
  const auth = read('public/integration.js');
  const expression = auth.match(/const greeting\s*=\s*([^;]+);/);
  assert.ok(expression, 'Greeting expression is missing');
  assert.match(expression[1], /salutation/);
  assert.doesNotMatch(expression[1], /\bname\b|firstName|lastName|user\.name/i);
  assert.match(auth, /gender==='male'\?'Hello handsome'/);
  assert.match(auth, /gender==='female'\?'Hello beautiful'/);
  assert.match(auth, /'Hello creator'/);
  assert.match(auth, /<select id="authGender" required>/);
  assert.match(auth, /<option value="male">Male<\/option>/);
  assert.match(auth, /<option value="female">Female<\/option>/);
});

test('Membership entry uses shared user session and payments remain disabled', () => {
  const membership = read('public/memberships.js');
  assert.match(html, /aria-label="View Memberships"/);
  assert.match(html, /<script src="\/memberships\.js\?/);
  assert.match(membership, /typeof state==='undefined'\|\|!state\.user/);
  assert.match(membership, /Checkout coming soon/);
  assert.match(membership, /disabled>/);
  for (const plan of ['Free', 'Premium', 'Pro']) assert.match(membership, new RegExp("name:'" + plan + "'"));
});

test('Music generation remains protected by server-side checks', () => {
  const api = read('api/index.js');
  assert.match(api, /path === '\/api\/music\/generate'/);
  assert.match(api, /const user = await auth\(req, res\)/);
  assert.match(api, /PUBLIC_MUSIC_GENERATION_ENABLED/);
  assert.match(api, /ro_reserve_song/);
  assert.match(api, /instrumental: false/);
});

test('SEO structured data and public legal links exist',()=>{
 const structured=scriptParts.filter(x=>x.structured);
 assert.equal(structured.length,1);
 const data=JSON.parse(structured[0].inline);
 assert.equal(data['@type'],'WebSite');
 assert.equal(data.url,'https://rhymeorbit.in/');
 assert.match(html,/rel="canonical" href="https:\/\/rhymeorbit\.in\/"/);
 for(const name of ['privacy','terms','copyright','features']){
  const content=read('public/'+name+'.html');
  assert.match(content,/rel="canonical"/);
  assert.match(content,/<h1>/);
 }
 assert.match(read('public/robots.txt'),/sitemap\.xml/);
 assert.match(read('public/sitemap.xml'),/<urlset/);
});
test('No fictional demo catalog or old assistant name is visible in main UI',()=>{
 assert.doesNotMatch(html,/YOUR CREATIVE SPACE/);
 assert.doesNotMatch(html,/FEATURED DEMO CREATOR/);
 assert.doesNotMatch(html,/Riya Grover/);
 assert.match(html,/riya-chat\.js/);
});
