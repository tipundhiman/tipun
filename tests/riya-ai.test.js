import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { handleApi } from '../api/index.js';

function mockResponse(data, status=200) {
  return { status, ok:status>=200&&status<300, async json(){return data}, async text(){return JSON.stringify(data)} };
}
async function sendAI(payload) {
  let status, body;
  const req={method:'POST',url:'/api/ai',headers:{authorization:'Bearer test-session','x-forwarded-for':'198.51.100.4'},socket:{remoteAddress:'198.51.100.4'},
    async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(payload))}};
  const res={writeHead(code){status=code},end(raw){body=JSON.parse(raw)}};
  await handleApi(req,res);
  return {status,body};
}

test('Riya uses a supported Gemini model and returns a real help response',async()=>{
  const previousFetch=globalThis.fetch;
  const keys=['GEMINI_API_KEY','GEMINI_MODEL','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{GEMINI_API_KEY:'test-secret',SUPABASE_URL:'https://database.example',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service'});
  delete process.env.GEMINI_MODEL;
  let chosenModel='',prompt='';
  globalThis.fetch=async(url,options={})=>{
    if(String(url).includes('/auth/v1/user'))return mockResponse({id:'test-user'});
    if(String(url).includes('/rest/v1/ro_account_ages'))return mockResponse([{user_id:'test-user'}]);
    if(String(url).includes('generativelanguage.googleapis.com')){
      chosenModel=String(url);prompt=JSON.parse(options.body).systemInstruction.parts[0].text;
      return mockResponse({candidates:[{content:{parts:[{text:'Namaste! Main Riya hoon.'}]}}]});
    }
    throw Error('Unexpected URL: '+url);
  };
  try {
    const result=await sendAI({kind:'help',input:'Namaste Riya, gaana kaise banega?'});
    assert.equal(result.status,200);
    assert.equal(result.body.text,'Namaste! Main Riya hoon.');
    assert.match(chosenModel,/gemini-3\.5-flash-lite:generateContent/);
    assert.match(prompt,/Free users can create up to 3 songs monthly/);
    const greeting=await sendAI({kind:'help',input:'Hi'});
    assert.equal(greeting.status,200,'Simple greetings should not be rejected');
  } finally {
    globalThis.fetch=previousFetch;
    for(const k of keys)previous[k]===undefined?delete process.env[k]:process.env[k]=previous[k];
  }
});

test('Riya recovers from an inaccessible legacy Gemini model without exposing provider details',async()=>{
  const previousFetch=globalThis.fetch;
  const keys=['GEMINI_API_KEY','GEMINI_MODEL','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{GEMINI_API_KEY:'test-secret',GEMINI_MODEL:'gemini-2.5-flash-lite',SUPABASE_URL:'https://database.example',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service'});
  const attempts=[];
  globalThis.fetch=async url=>{
    if(String(url).includes('/auth/v1/user'))return mockResponse({id:'test-user'});
    if(String(url).includes('/rest/v1/ro_account_ages'))return mockResponse([{user_id:'test-user'}]);
    attempts.push(String(url));
    if(attempts.length===1)return mockResponse({error:{status:'NOT_FOUND',message:'restricted model'}},404);
    return mockResponse({candidates:[{content:{parts:[{text:'Try a gentle piano chord.'}]}}]});
  };
  try {
    const result=await sendAI({kind:'help',input:'Write me a hook please'});
    assert.equal(result.status,200);
    assert.equal(result.body.text,'Try a gentle piano chord.');
    assert.match(attempts[0],/gemini-2\.5-flash-lite/);
    assert.match(attempts[1],/gemini-3\.5-flash-lite/);
  } finally {
    globalThis.fetch=previousFetch;
    for(const k of keys)previous[k]===undefined?delete process.env[k]:process.env[k]=previous[k];
  }
});

test('Riya chat offers a sign-in action when the visitor has no session',async()=>{
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const chat=readFileSync(join(root,'public/riya-chat.js'),'utf8');
  const notices=[];
  const elements={
    roRiyaThread:{appendChild(node){notices.push(node.children[1].textContent)},scrollHeight:5,scrollTop:0},
    roRiyaSend:{disabled:false},
    roRiyaStatus:{textContent:''},
    roRiyaSignIn:{hidden:true},
    roOrbitHelpQuestion:{value:'Hi',focus(){}},
    roOrbitHelpPanel:{hidden:true},
    roOrbitHelpButton:{setAttribute(){},focus(){}}
  };
  const context=createContext({
    document:{getElementById:id=>elements[id]||null,createElement(){return {className:'',children:[],append(...items){this.children.push(...items)}}}},
    window:{addEventListener(){}},state:{user:null},sb:{auth:{getSession:async()=>({data:{session:null}})}}
  });
  runInContext(chat,context);
  await runInContext('roAskOrbitHelp()',context);
  assert.equal(elements.roRiyaSignIn.hidden,false);
  assert.match(notices.at(-1),/Please sign in/);
  assert.equal(elements.roRiyaSend.disabled,false);
  assert.equal(elements.roRiyaStatus.textContent,'');
});
