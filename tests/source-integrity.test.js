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
  assert.match(membership, /Checkout unavailable/);
  assert.match(membership, /disabled>/);
  for (const plan of ['Free', 'Premium', 'Pro']) assert.match(membership, new RegExp("name:'" + plan + "'"));
});

test('Music generation remains protected by server-side checks', () => {
  const api = read('api/index.js');
  assert.match(api, /path === '\/api\/music\/generate'/);
  assert.match(api, /const user = await auth\(req, res\)/);
  assert.match(api, /PUBLIC_MUSIC_GENERATION_ENABLED/);
  assert.match(api, /ro_reserve_song/);
  assert.match(api, /instrumental:\s*false/);
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
test('Public SEO URLs agree across sitemap, canonical tags and internal navigation',()=>{
 const sitemap=read('public/sitemap.xml');
 for(const name of ['features','privacy','terms','copyright']){
  const canonical='https://rhymeorbit.in/'+name;
  const content=read('public/'+name+'.html');
  assert.ok(sitemap.includes('<loc>'+canonical+'</loc>'), name+' missing from sitemap');
  assert.ok(content.includes('rel="canonical" href="'+canonical+'"'), name+' canonical points at a redirect');
  assert.ok(!content.includes('href="/'+name+'.html"'), name+' links to redirected URL');
  assert.ok(!html.includes('href="/'+name+'.html"'), 'home links to redirected '+name+' URL');
  assert.doesNotMatch(html,new RegExp('/'+name+'\\.html'),'home has a legacy '+name+' link');
 }
 assert.match(read('public/features.html'),/Full songs with vocals — available for eligible users/);
 assert.doesNotMatch(read('public/features.html'),/planned vocal music generation|integration in progress/i);
});
test('Public landing animations remain accessible and in-app video tiles do not redirect',()=>{
 assert.match(html,/roObserveLandingMotion/);
 assert.match(html,/prefers-reduced-motion:reduce/);
 assert.match(html,/youtube-fallback\.js/);
 const fallback=read('public/youtube-fallback.js');
 assert.match(fallback,/showFeatured/);
 assert.match(fallback,/window\.roYtPlay/);
 assert.doesNotMatch(fallback,/https:\/\/www\.youtube\.com\/results\?search_query=/);
});
test('Dedicated search landing pages provide accurate, indexable creator flows',()=>{
 const sitemap=read('public/sitemap.xml');
 const styles=read('public/landing.css');
 assert.match(styles,/prefers-reduced-motion:reduce/);
 for(const name of ['ai-song-generator','ai-lyrics-generator','shayari-generator']){
  const page=read('public/'+name+'.html');
  const canonical='https://rhymeorbit.in/'+name;
  assert.ok(sitemap.includes('<loc>'+canonical+'</loc>'),name+' missing from sitemap');
  assert.ok(page.includes('rel="canonical" href="'+canonical+'"'),name+' missing clean canonical');
  assert.match(page,/<title>[^<]+RhymeOrbit<\/title>/);
  assert.match(page,/<meta name="description" content="[^"]+">/);
  assert.match(page,/href="\/#studio"/);
  assert.match(page,/href="\/landing.css"/);
  assert.ok(html.includes('/'+name),'Homepage must link to '+name);
 }
 assert.match(read('public/ai-song-generator.html'),/Commercial rights are not automatically granted/);
 assert.match(read('public/ai-lyrics-generator.html'),/provider capacity and usage controls/);
});
test('No fictional demo catalog or old assistant name is visible in main UI',()=>{
 assert.doesNotMatch(html,/YOUR CREATIVE SPACE/);
 assert.doesNotMatch(html,/FEATURED DEMO CREATOR/);
 assert.doesNotMatch(html,/Riya Grover/);
 assert.match(html,/riya-chat\.js/);
});

test('Public music quota and ownership are enforced server-side',()=>{
 const api=read('api/index.js');
 const migration=read('supabase/migrations/20261024_public_music_launch.sql');
 assert.match(api,/path === '\/api\/music\/generate'/);
 assert.match(api,/ro_reserve_song/);
 assert.match(api,/music_generation_reservations\?user_id=eq\./);
 assert.match(api,/ro_refund_failed_song/);
 assert.match(api,/ideaOrLyrics/);
 assert.match(api,/isFullLyrics\?\{lyrics:ideaOrLyrics\}:\{\}/);
 assert.match(migration,/create table if not exists public\.music_generation_reservations/);
 assert.match(migration,/create table if not exists public\.generated_songs/);
 assert.match(migration,/v_limit:=least\(3/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/create or replace function public\.ro_refund_failed_song/);
 assert.match(migration,/audio\/ogg/);
});
test('Public AI Studio is a single no-popup vocal-song workflow',()=>{
 assert.match(html,/id="songLyrics"/);
 assert.match(html,/id="roCanvasGenerate"/);
 assert.match(html,/id="roSongGenerate"/);
 assert.match(html,/id="roSongCreditStatus"/);
 assert.doesNotMatch(html,/id="roCanvasPrompt"/);
 assert.doesNotMatch(html,/Music style \(Treblo\)|No AI API connected yet/);
 const generation=html.slice(html.indexOf('window.roStartMurekaTest=async function(){'));
 assert.ok(generation.includes("/api/music/generate"));
 assert.ok(!generation.slice(0,2500).includes("confirm("));
});
