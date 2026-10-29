/* RhymeOrbit local Family Guard. Device convenience lock, not verified age or parental consent. */
(function(){
'use strict';
if(window.roFamilyGuard)return;
const P='ro_kids_parent_guard_v1',U='ro_kids_usage_v1',ITERATIONS=160000,MAX_FAILS=5;
const today=()=>new Date().toLocaleDateString('en-CA');
const settingsDefault={minutes:30,allowExport:false};
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const configured=()=>{const p=read(P);return !!(p&&p.salt&&p.hash)};
const settings=()=>{const p=read(P);return {minutes:[15,30,45,60,90].includes(p?.minutes)?p.minutes:30,allowExport:p?.allowExport===true}};
const toHex=u=>Array.from(u).map(v=>v.toString(16).padStart(2,'0')).join('');
const fromHex=s=>new Uint8Array((s.match(/.{2}/g)||[]).map(h=>parseInt(h,16)));
async function hashPin(pin,salt){
if(!crypto?.subtle)throw Error('Secure HTTPS connection is required');
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:fromHex(salt),iterations:ITERATIONS,hash:'SHA-256'},key,256);
return toHex(new Uint8Array(bits));
}
async function create(pin,minutes=30,allowExport=false){
if(configured())throw Error('A parent PIN already exists. Unlock settings to change it.');
if(!/^[0-9]{6,12}$/.test(pin))throw Error('Choose a 6–12 digit PIN.');
if(!crypto?.getRandomValues)throw Error('Secure browser is required');
const salt=toHex(crypto.getRandomValues(new Uint8Array(16))),hash=await hashPin(pin,salt);
if(!write(P,{salt,hash,minutes:[15,30,45,60,90].includes(minutes)?minutes:30,allowExport:allowExport===true,failed:0,lockedUntil:0}))throw Error('Local storage is unavailable');
return true;
}
async function verify(pin){
const p=read(P);if(!configured())return false;
if(p.lockedUntil>Date.now())throw Error('Too many attempts. Try again after 15 minutes.');
if(!/^[0-9]{6,12}$/.test(String(pin||'')))return false;
const trial=await hashPin(pin,p.salt);
const candidate=fromHex(trial),expected=fromHex(p.hash);
let mismatch=0;for(let i=0;i<32;i++)mismatch|=candidate[i]^expected[i];
if(mismatch===0){write(P,{...p,failed:0,lockedUntil:0});return true}
const failed=(p.failed||0)+1;
write(P,{...p,failed:failed>=MAX_FAILS?0:failed,lockedUntil:failed>=MAX_FAILS?Date.now()+15*60*1000:0});
return false;
}
function update(minutes,allowExport){
const p=read(P);if(!configured())throw Error('Set parent PIN first');
if(![15,30,45,60,90].includes(minutes))throw Error('Invalid duration');
if(!write(P,{...p,minutes,allowExport:allowExport===true}))throw Error('Could not save settings');
return true;
}
function usage(){const u=read(U);return u?.day===today()?Math.max(0,Math.min(1440,Number(u.minutes)||0)):0}
function remaining(){return Math.max(0,settings().minutes-usage())}
function addMinute(){const n=usage();write(U,{day:today(),minutes:n+1});return remaining()}
window.roFamilyGuard=Object.freeze({configured,create,verify,update,settings,remaining,addMinute});
})();