import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createContext,runInContext} from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const integration=readFileSync(join(root,'public/integration.js'),'utf8');
const start=integration.indexOf('async function roGenerateAIText');
const end=integration.indexOf('async function initBackend',start);
assert.ok(start>0&&end>start,'Shared Gemini API function not found');
const helper=integration.slice(start,end);

test('Riya and AI Studio lyrics use exactly the same authenticated Gemini endpoint and session',async()=>{
 const requests=[];
 const ctx=createContext({
  sb:{auth:{getSession:async()=>({data:{session:{access_token:'session-token'}}})}},
  window:{},
  fetch:async(url,opts)=>{
   requests.push({url,opts,body:JSON.parse(opts.body)});
   return {ok:true,async json(){return {text:'Original AI output'}}};
  }
 });
 runInContext(helper,ctx);
 assert.equal(await runInContext("roGenerateAIText('lyrics','Romantic Hindi song')",ctx),'Original AI output');
 assert.equal(await runInContext("window.roGenerateAIText('help','Hi Riya')",ctx),'Original AI output');
 assert.deepEqual(requests.map(r=>r.url),['/api/ai','/api/ai']);
 assert.deepEqual(requests.map(r=>r.opts.headers.Authorization),['Bearer session-token','Bearer session-token']);
 assert.deepEqual(requests.map(r=>r.body.kind),['lyrics','help']);
});

test('Shared Gemini client identifies an HTML/deployment response instead of silently failing',async()=>{
 const ctx=createContext({
  sb:{auth:{getSession:async()=>({data:{session:{access_token:'session-token'}}})}},
  window:{},
  fetch:async()=>({ok:false,status:500,async json(){throw SyntaxError('Unexpected HTML')}})
 });
 runInContext(helper,ctx);
 await assert.rejects(runInContext("roGenerateAIText('help','Hello')",ctx),/This deployment did not return an AI response/);
});
