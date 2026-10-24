import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const rootDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(join(rootDir,'public/index.html'),'utf8');
const api=readFileSync(join(rootDir,'api/index.js'),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
 .filter(m=>!/\bsrc=|application\/ld\+json/.test(m[1]))
 .map(m=>m[2]);
const song=scripts.find(s=>s.includes('function roMakeSongCard('));
assert.ok(song,'Canonical music player module must exist');
function chunk(start,end){
 const a=song.indexOf(start),b=song.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Song script boundaries missing');
 return song.slice(a,b);
}
class El {
 constructor(tag){
  this.tagName=tag;this.children=[];this.parent=null;this.dataset={};this.className='';
  this.style={};this.textContent='';this.value='';this.listeners={};this.attributes={};
  this.currentTime=0;this.duration=NaN;this.paused=true;this.disabled=false;
 }
 append(...nodes){for(const n of nodes){if(!n||typeof n==='string')continue;n.remove();this.children.push(n);n.parent=this}}
 appendChild(n){this.append(n);return n}
 replaceChildren(...nodes){for(const c of this.children)c.parent=null;this.children=[];this.textContent='';this.append(...nodes)}
 insertBefore(n,ref){n.remove();const at=ref?this.children.indexOf(ref):-1;this.children.splice(at<0?this.children.length:at,0,n);n.parent=this;return n}
 insertAdjacentElement(position,n){assert.equal(position,'afterend');assert.ok(this.parent);this.parent.insertBefore(n,this.parent.children[this.parent.children.indexOf(this)+1]||null)}
 replaceWith(n){if(this.parent){this.parent.insertBefore(n,this);this.remove()}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}
 get lastElementChild(){return this.children.at(-1)}
 setAttribute(k,v){this.attributes[k]=String(v)}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
 emit(k){for(const fn of this.listeners[k]||[])fn()}
 matching(sel){
  if(sel.startsWith('.'))return this.className.split(/\s+/).includes(sel.slice(1));
  if(sel==='[data-ro-started]')return this.dataset.roStarted!==undefined;
  return this.tagName===sel;
 }
 querySelector(sel){const q=[...this.children];while(q.length){const x=q.shift();if(x.matching(sel))return x;q.unshift(...x.children)}return null}
 querySelectorAll(sel){const q=[...this.children],out=[];while(q.length){const x=q.shift();if(x.matching(sel))out.push(x);q.unshift(...x.children)}return out}
}
function visible(node){return [node.textContent,...node.children.map(visible)].filter(x=>typeof x==='string').join(' ')}
function fixture(initial=[]){
 const studio=new El('main'),projects=new El('main'),data=new Map();
 const state={user:{id:'sample-account'},page:'studio'};
 const localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
 data.set('ro_treblo_library_sample-account',JSON.stringify(initial));
 const document={createElement:tag=>new El(tag),visibilityState:'visible',
  getElementById:id=>id==='roSongLibraryItems'?studio:id==='roMyStudioSongs'?projects:null};
 const window={roRecoverTrebloSong(){},roDeleteSong(){},roLoadCloudSongs(){}};
 const context=createContext({document,window,state,localStorage,setInterval(){},console});
 runInContext(chunk("  const trebleStorageKey='ro_treblo_last_task';","  window.roRefreshMusicCredits=async function(){")+'\n'+
  chunk('  function roClock(sec){','  const roBaseProjectsSongs=window.projects;'),context);
 return {studio,projects,state,window,context,run:s=>runInContext(s,context)};
}
test('Cloud-ready song gets visible full audio player, real elapsed time and seek control',()=>{
 const uid='internal-task-id-should-not-appear';
 const env=fixture([{id:uid,title:'Raahon Me Khoya Chaand',status:'ready',voice:'female',
   cloudSaved:true,url:'https://example.com/private-audio.mp3'}]);
 env.window.roRenderSongLibrary();
 const card=env.studio.children[0],audio=card.querySelector('audio');
 assert.ok(audio,'Native player with full audio controls');
 assert.equal(audio.controls,true);
 assert.equal(audio.preload,'metadata');
 const seek=card.querySelector('input');
 assert.ok(seek,'Accessible progress scrubber');
 assert.equal(seek.attributes['aria-label'],'Seek within song');
 assert.equal(visible(card).includes(uid),false,'Internal task ID must stay invisible');
 audio.currentTime=74;audio.duration=204;audio.emit('loadedmetadata');audio.emit('timeupdate');
 const timeline=card.querySelector('.ro-song-timeline');
 assert.match(visible(timeline),/1:14/);
 assert.match(visible(timeline),/3:24/);
 assert.equal(seek.disabled,false);
 seek.value='500';seek.emit('input');
 assert.equal(audio.currentTime,102);
 env.window.roRenderSongLibrary();
 assert.equal(env.studio.children[0],card,'Re-render must preserve currently playing audio controls');
});
test('Pending track displays truthful stage instead of fake percent or task key',()=>{
 const id='internal-pending-id';
 const env=fixture([{id,title:'New Song',status:'Checking',createdAt:'2026-10-24T00:10:00Z'}]);
 env.window.roRenderSongLibrary();
 const card=env.studio.children[0];
 assert.ok(card.querySelector('.ro-song-pending-track'));
 assert.equal(card.querySelector('audio'),null,'Audio must not be fabricated before ready');
 assert.doesNotMatch(visible(card),/internal-pending-id|\b[1-9][0-9]?% done\b/);
 assert.equal(card.querySelector('.ro-song-pending-track').attributes['aria-valuetext'],'Generating; percentage unavailable');
 env.run("roLibraryUpsert('internal-pending-id',{status:'Cloud saved',cloudSaved:true,url:'https://example.com/finished.ogg'})");
 assert.ok(env.studio.children[0].querySelector('audio'),'Cloud-ready song immediately becomes playable');
});
test('My Studio and AI Studio use the same shared player card',()=>{
 const env=fixture([{id:'task-internal',title:'Test Duet',status:'ready',voice:'duet',cloudSaved:true,
  url:'https://example.com/saved.ogg'}]);
 env.window.roRenderSongLibrary();
 env.window.roRenderMyStudioSongs();
 assert.ok(env.studio.children[0].querySelector('.ro-song-player'));
 assert.ok(env.projects.children[0].querySelector('.ro-song-player'));
 assert.equal(visible(env.projects.children[0]).includes('task-internal'),false);
});
test('A blocked cross-origin player falls back to private same-origin playback and offers download',()=>{
 const env=fixture([{id:'private-track',title:'Khoyi Hui Si Raat',status:'ready',cloudSaved:true,
  url:'https://r2.example.com/signed.ogg',proxyUrl:'/api/music/audio/private-track?token=signed-token'}]);
 env.window.roRenderSongLibrary();
 const card=env.studio.children[0],audio=card.querySelector('audio');
 assert.equal(audio.src,'https://r2.example.com/signed.ogg');
 audio.emit('error');
 assert.equal(audio.src,'/api/music/audio/private-track?token=signed-token');
 assert.match(visible(card),/Switching to secure playback/);
 audio.emit('loadedmetadata');
 assert.doesNotMatch(visible(card),/Switching to secure playback/);
 const download=card.querySelectorAll('button').find(button=>button.textContent.includes('Download song'));
 assert.ok(download,'Private cloud-saved song has a download action');
 const open=card.querySelector('a');
 assert.match(open.href,/^\/api\/music\/audio\//);
});
test('Library API includes creation time for real pending elapsed timer',()=>{
 assert.match(api,/createdAt:row\.created_at/);
 assert.match(song,/roClock\(Math\.floor\(\(Date\.now\(\)-started\)\/1000\)\)/);
 assert.doesNotMatch(song,/Task ID: '\+id|Song ID: '\+id|info\.textContent=.*item\.id/);
});
