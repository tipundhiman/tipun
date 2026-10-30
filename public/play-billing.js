/* RhymeOrbit — Google Play Billing TWA feature detection (PREVIEW ONLY).
   Checkout is disabled until verified backend receipts & paid credits are ready.
   Do not enable client-side payments based on browser feature detection. */
(function(){
'use strict';
const PLAY_BILLING='https://play.google.com/billing';
let ready=null;
async function status(){
 try{
  const r=await fetch('/api/play-billing/status',{cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)return {enabled:false,reason:'Billing server unavailable'};
  const j=await r.json();
  return {enabled:j.enabled===true&&j.checkoutEnabled===true,reason:String(j.reason||'')};
 }catch{return {enabled:false,reason:'No billing connection'}}
}
async function detect(){
 if(!('getDigitalGoodsService' in window))return {supported:false,reason:'Google Play Billing is available only in the Play-installed Android app'};
 try{
  const goods=await window.getDigitalGoodsService(PLAY_BILLING);
  return goods?{supported:true,service:goods}:{supported:false,reason:'Play Store digital goods unavailable'};
 }catch{return {supported:false,reason:'Play Store billing delegation unavailable'}}
}
async function check(){
 if(ready)return ready;
 ready=(async()=>{const server=await status();if(!server.enabled)return {...server,supported:false};
  const device=await detect();return {...server,...device};
 })();return ready;
}
async function getProductDetails(ids){
 const configuration=await check();
 if(!configuration.enabled||!configuration.supported||!configuration.service) return [];
 const allowed=Array.isArray(ids)?ids.filter(x=>/^[a-z][a-z0-9_.]{1,80}$/.test(String(x))).slice(0,8):[];
 if(!allowed.length)return [];
 try{return await configuration.service.getDetails(allowed)}
 catch{return []}
}
// Price discovery is safe before checkout: Digital Goods returns store-localized
// prices but never charges. Each response is sanitized for UI consumption.
async function previewProducts(ids){
 const idsSafe=Array.isArray(ids)?ids.filter(x=>/^[a-z][a-z0-9_.]{1,80}$/.test(String(x))).slice(0,8):[];
 if(!idsSafe.length)return {supported:false,products:[]};
 const device=await detect();
 if(!device.supported||!device.service)return {supported:false,products:[]};
 try{
  const details=await device.service.getDetails(idsSafe);
  const products=(Array.isArray(details)?details:[]).filter(x=>idsSafe.includes(x?.itemId)).map(item=>{
   const currency=String(item?.price?.currency||'');
   const amount=Number(item?.price?.value);
   let priceText='';
   if(/^[A-Z]{3}$/.test(currency)&&Number.isFinite(amount)&&amount>=0){
    try{priceText=new Intl.NumberFormat(navigator.language,{style:'currency',currency}).format(amount)}
    catch{priceText=currency+' '+amount.toFixed(2)}
   }
   return {productId:String(item.itemId),priceText};
  }).filter(x=>x.priceText);
  return {supported:true,products};
 }catch{return {supported:true,products:[]}}
}
// Intentionally no PaymentRequest or token-storage code yet. Checkout cannot
// start until a server-verified, acknowledged, refundable subscription flow,
// Play Console catalog and atomic paid entitlements pass live tester tests.
window.roPlayBilling=Object.freeze({check,getProductDetails,previewProducts,readyForCheckout:()=>false});
})();