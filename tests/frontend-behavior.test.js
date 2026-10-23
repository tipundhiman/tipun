import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
const html=read('public/index.html');
const main=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(x=>x[2]).find(s=>s.includes('const state='));
assert.ok(main,'Main app JavaScript not found');
function start(storedUser=null){
 const node={innerHTML:''};
 const context=createContext({
  document:{getElementById:id=>id==='root'?node:null,title:''},
  window:{addEventListener(){}},
  localStorage:{getItem:key=>key==='ro_luxe_user'?JSON.stringify(storedUser):null,setItem(){}},
  location:{hash:'#home'},history:{replaceState(){}},console
 });
 runInContext(main,context);
 return {node,context,exec:s=>runInContext(s,context)};
}
test('Stale demo user does not authenticate',()=>{
 const app=start({id:'old-local-user',name:'Old User'});
 assert.equal(app.exec('state.user'),null);
 assert.doesNotMatch(app.node.innerHTML,/aria-label="View Memberships"/);
});
test('Memberships visible only after login, including the mobile menu',()=>{
 const app=start();
 app.exec("state.user={id:'real-user',name:'Test User',gender:'male'};render()");
 assert.match(app.node.innerHTML,/aria-label="View Memberships"/);
 app.exec('state.mobile=true;render()');
 assert.match(app.node.innerHTML,/mobile-drawer/);
 assert.match(app.node.innerHTML,/✦ Memberships/);
 app.exec('state.page="home";state.user=null;render()');
 assert.doesNotMatch(app.node.innerHTML,/aria-label="View Memberships"/);
});
test('Existing users can set greeting preference from Profile',()=>{
 const app=start();
 app.exec("state.user={id:'real-user',name:'Test User',gender:'female'};state.page='profile';render()");
 assert.match(app.node.innerHTML,/id="profileGreetingGender"/);
 assert.match(app.node.innerHTML,/Save greeting preference/);
 assert.match(read('public/integration.js'),/sb\.auth\.updateUser\(\{data:\{gender\}\}\)/);
});
test('Spoken welcome and toast never mention names',()=>{
 const auth=read('public/integration.js');
 const from=auth.indexOf('let roWelcomedUser=null;'),to=auth.indexOf('\nopenAuth=function',from);
 assert.ok(from>=0&&to>from,'Welcome function missing');
 const messages=[],spoken=[],storage=new Map();
 const ctx=createContext({
  state:{user:null},
  sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  toast:t=>messages.push(t),
  window:{speechSynthesis:{cancel(){},getVoices(){return []},speak:u=>spoken.push(u.text)}},
  SpeechSynthesisUtterance:class{constructor(t){this.text=t}},console
 });
 runInContext(auth.slice(from,to),ctx);
 for(const [gender,expected] of [['male','Hello handsome'],['female','Hello beautiful'],['non_binary','Hello creator'],['prefer_not_to_say','Hello creator']]){
  const name='PRIVATE_NAME_'+gender;
  ctx.state.user={id:gender,name,gender};
  runInContext('roWelcomeBack()',ctx);
  assert.ok(messages.at(-1).startsWith(expected+'!'));
  assert.ok(!messages.at(-1).includes(name),'Personal name included in welcome');
  assert.equal(spoken.at(-1),messages.at(-1));
 }
});
test('Membership popup blocks guests, shows all three plans and closes on signout',()=>{
 const dialogs=[];
 const document={
  head:{appendChild(){}},body:{appendChild:el=>dialogs.push(el)},addEventListener(){},
  createElement(){return {id:'',innerHTML:'',removed:false,remove(){this.removed=true},querySelector(){return {focus(){},onclick:null}},querySelectorAll(){return []}}},
  getElementById:id=>dialogs.find(x=>x.id===id&&!x.removed)||null
 };
 const ctx=createContext({document,window:{},state:{user:null},console});
 runInContext(read('public/memberships.js'),ctx);
 runInContext("window.roOpenPricing('plans')",ctx);
 assert.equal(dialogs.length,0);
 ctx.state.user={id:'member'};
 runInContext("window.roOpenPricing('plans')",ctx);
 assert.equal(dialogs.length,1);
 for(const name of ['Free','Premium','Pro'])assert.ok(dialogs[0].innerHTML.includes('<h3>'+name+'</h3>'));
 assert.equal((dialogs[0].innerHTML.match(/<button type="button" disabled>/g)||[]).length,3);
 runInContext('window.roCloseMemberships()',ctx);
 assert.equal(dialogs[0].removed,true);
});

test('AI Studio has a single canonical set of song-generation controls',()=>{
 const app=start();
 app.exec("state.user={id:'real-user',name:'Test Creator'};state.page='studio'");
 const studio=app.exec('studio()');
 for(const id of ['roCanvasGenerate','roCanvasPrompt','roCanvasGenerationStatus']){
  assert.equal(studio.split('id="'+id+'"').length-1,1,'Duplicate or missing '+id);
 }
});

test('Riya chat uses authenticated requests and text-only bubbles',()=>{
 const chat=read('public/riya-chat.js');
 assert.match(html,/Chat with Riya/);
 assert.match(chat,/kind:'help'/);
 assert.match(chat,/session\?\.access_token/);
 assert.match(chat,/textContent=/);
 assert.doesNotMatch(chat,/innerHTML/);
});
test('Discover replaces fictional tracks with real feature destinations',()=>{
 const app=start();
 app.exec("state.page='discover';render()");
 assert.match(app.node.innerHTML,/Creator community/);
 assert.match(app.node.innerHTML,/Listen & Chill/);
 assert.doesNotMatch(app.node.innerHTML,/DEMO SUGGESTION|FEATURED DEMO CREATOR/);
 assert.doesNotMatch(app.node.innerHTML,/YOUR CREATIVE SPACE/);
});
