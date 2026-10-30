import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 NOTES,wordCount,lineCount,syllableEstimate,findRhyme,repeats,arrangement,makeLrc,
 tapBpm,keyTranspose,scaleNotes,chordProgression,noteFrequency,barDuration,
 validateSplits,trackingUrl,metadataBrief,hookIdea
} from '../public/creator-lab-core.js';

const source=filename=>readFileSync(new URL('../public/'+filename,import.meta.url),'utf8');

test('Creator Lab exposes exactly 20 distinct functional cards and their action wiring',()=>{
 const html=source('creator-lab.html'),ui=source('creator-lab.js');
 const ids=[...html.matchAll(/id="tool(\d+)"/g)].map(m=>Number(m[1]));
 assert.deepEqual(ids,Array.from({length:20},(_,i)=>i+1));
 assert.equal((html.match(/<article class="cl-card"/g)||[]).length,20);
 const actions=[...html.matchAll(/data-action="([^"]+)"/g)].map(x=>x[1]);
 for(const action of actions)assert.ok(ui.includes(action+':')||ui.includes("'"+action+"':"),'Missing functional event '+action);
 assert.match(html,/script type="module" src="\/creator-lab.js/);
 assert.match(html,/age-check\.html/);
 assert.doesNotMatch(ui,/fetch\(/,'Creator Lab must not send content to any network');
 assert.doesNotMatch(ui,/api\/music\/generate|PaymentRequest|SUPABASE_SERVICE_ROLE_KEY/);
});
test('Creator Lab is linked from home, footer, feature finder, mobile navigation and sitemap',()=>{
 for(const file of ['index.html','features.html','site-nav.js','feature-guide.js','mobile-app.js','sitemap.xml'])
  assert.match(source(file),/creator-lab/,file);
 assert.match(source('_headers'),/\/creator-lab\*[\s\S]*microphone=\(self\)/);
 assert.match(source('creator-lab.css'),/max-width:520px/);
});
test('Unicode lyric counts, rough English syllables and repeated lines are honest',()=>{
 assert.equal(wordCount('one two three'),3);
 assert.ok(wordCount('नमस्ते दुनिया')>=2);
 assert.equal(lineCount('one\n\nTwo'),2);
 assert.equal(syllableEstimate('hello world'),3);
 assert.deepEqual(repeats('Hello there\nHi\nHELLO THERE\nHello there'),[{line:'Hello there',count:3}]);
});
test('Rhyme bank only offers supported English pockets, no fake dictionary results',()=>{
 assert.ok(findRhyme('night').includes('light'));
 assert.ok(!findRhyme('night').includes('night'));
 assert.deepEqual(findRhyme('chromaticexpansion'),[]);
});
test('Arrangement and LRC use validated, ordered song timing',()=>{
 const plan=arrangement('Verse:16\nChorus:8',120);
 assert.equal(plan.bars,24);
 assert.equal(plan.seconds,48);
 assert.equal(plan.sections[1].start,32);
 assert.throws(()=>arrangement('Verse:-5',120));
 assert.equal(makeLrc('00:10.50 | Hello\n00:14 | Chorus'),'[00:10.50]Hello\n[00:14.00]Chorus\n');
 assert.throws(()=>makeLrc('00:30 | Later\n00:10 | Earlier'),/order/);
 assert.throws(()=>makeLrc('00:60 | Invalid'));
});
test('Tempo, metronome calculations, harmony and frequencies return correct musical numbers',()=>{
 assert.equal(tapBpm([0,500,1000,1500]),120);
 assert.equal(keyTranspose('Cm',2),'Dm');
 assert.equal(keyTranspose('B',2),'C#');
 assert.deepEqual(scaleNotes('C','major'),['C','D','E','F','G','A','B']);
 assert.deepEqual(chordProgression('C','major'),['C','G','Am','F']);
 assert.deepEqual(chordProgression('A','minor'),['Am','F','C','G']);
 assert.equal(NOTES.length,12);
 assert.equal(noteFrequency(69).hz,440);
 assert.equal(noteFrequency(60).name,'C4');
 assert.equal(barDuration(16,120),32);
 assert.throws(()=>barDuration(-10,120));
});
test('Global release tools validate rights metadata, legal splits and secure tracking URL',()=>{
 assert.deepEqual(validateSplits('Alex | 50\nSam | 50').entries,[{name:'Alex',percent:50},{name:'Sam',percent:50}]);
 assert.equal(validateSplits('Alex | 60\nSam | 30').valid,false);
 assert.throws(()=>validateSplits('Alex | 50\nAlex | 50'),/Duplicate/);
 assert.throws(()=>validateSplits('Alex | -5'),/Line/);
 assert.equal(new URL(trackingUrl('https://example.com/music?q=1','instagram','launch')).searchParams.get('utm_source'),'instagram');
 assert.throws(()=>trackingUrl('javascript:alert(1)','source','launch'),/https/);
 assert.match(metadataBrief({title:'Original',artist:'Creator',genre:'Hindi pop',credits:'Music by me'}),/Hindi pop/);
 assert.throws(()=>metadataBrief({title:'',artist:'Creator'}));
});
test('Global hook prompts are language-aware and do not call AI or use paid credits',()=>{
 for(const language of ['en','hi','es','pt','fr','ur']){
  assert.ok(hookIdea(language,'hope').length>20);
  assert.ok(hookIdea(language,'party').length>20);
 }
 assert.throws(()=>hookIdea('en','unknown mood'));
});
