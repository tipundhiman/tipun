import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('Every public legal and feature page has canonical URL, contact and internal navigation',()=>{
  for(const name of ['features','terms','privacy','copyright']){
    const page=read('public/'+name+'.html');
    assert.match(page,new RegExp('href="https://rhymeorbit\\.in/'+name+'"'));
    assert.match(page,/mailto:dtipun@gmail\.com/);
    assert.match(page,/href="\/terms"/);
    assert.match(page,/href="\/privacy"/);
    assert.match(page,/href="\/copyright"/);
  }
});

test('Current terms and privacy clearly describe provider-backed streams and local karaoke recordings',()=>{
  const terms=read('public/terms.html');
  const privacy=read('public/privacy.html');
  const features=read('public/features.html');
  assert.match(terms,/YouTube's player/);
  assert.match(terms,/No listing is a guarantee that a recording is officially licensed/i);
  assert.match(terms,/microphone-only/);
  for(const provider of ['Supabase','Cloudflare R2','Gemini','Audius','Jamendo','YouTube'])assert.ok(privacy.includes(provider));
  assert.match(privacy,/edited practice lyrics/);
  assert.match(privacy,/until you delete them or clear browser data/);
  assert.match(features,/Trending|trending/);
  assert.match(features,/Audius/);
  assert.match(features,/YouTube Data API/);
});

test('Navigation icons and first-visit guide stay tidy on music and editor pages',()=>{
  const index=read('public/index.html');
  const guide=read('public/feature-guide.js');
  assert.match(index,/sing:'🎙'/);
  assert.match(index,/\['sing','Sing Your Song'\]/);
  assert.match(guide,/location\.pathname==='\/'/);
  assert.match(guide,/location\.hash==='\#home'/);
});
